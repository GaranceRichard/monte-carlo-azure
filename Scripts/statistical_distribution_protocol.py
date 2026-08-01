"""Independent validation and seed construction for distributional parity."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "contracts/statistical-distribution-protocol-v1.0.json"
PROTOCOL_SCHEMA_PATH = ROOT / "contracts/statistical-distribution-protocol-v1.0.schema.json"
SEEDS_PATH = ROOT / "contracts/statistical-distribution-seeds-v1.0.json"
SEEDS_SCHEMA_PATH = ROOT / "contracts/statistical-distribution-seeds-v1.0.schema.json"
CORPUS_PATH = ROOT / "contracts/statistical-reference-corpus-v1.0.json"


class ProtocolBundleError(ValueError):
    """Carry a stable invalidity class and actionable diagnostics."""

    def __init__(self, classification: str, diagnostics: list[str]) -> None:
        super().__init__(" ".join(diagnostics))
        self.classification = classification
        self.diagnostics = diagnostics


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ProtocolBundleError(
            "protocol_error", [f"Autorité illisible : {path}: {exc}."],
        ) from exc
    except json.JSONDecodeError as exc:
        raise ProtocolBundleError(
            "protocol_error", [f"JSON invalide : {path}:{exc.lineno}:{exc.colno}."],
        ) from exc


def _pointer(parts: list[object]) -> str:
    encoded = [str(part).replace("~", "~0").replace("/", "~1") for part in parts]
    return "/" + "/".join(encoded) if encoded else "/"


def schema_issues(instance: Any, schema: Any, label: str) -> list[str]:
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        return [f"Schéma {label} invalide : {exc.message}."]
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.absolute_path))
    return [
        f"{label}{_pointer(list(error.absolute_path))}: {error.message} "
        f"(mot-clé {error.validator})."
        for error in errors
    ]


def _canonical_fingerprint(values: list[int]) -> str:
    payload = json.dumps(values, separators=(",", ":")).encode("ascii")
    return hashlib.sha256(payload).hexdigest()


def generate_seed_population(seed_document: dict[str, Any]) -> list[int]:
    construction = seed_document["construction"]
    namespace = construction["namespace"].encode("utf-8")
    expected_size = construction["size"]
    population: list[int] = []
    counter = 0
    while len(population) < expected_size:
        material = namespace + b":" + str(counter).encode("ascii")
        candidate = int.from_bytes(hashlib.sha256(material).digest()[:4], "big")
        if candidate not in population:
            population.append(candidate)
        counter += 1
    return population


def partitioned_seeds(seed_document: dict[str, Any]) -> dict[str, list[int]]:
    population = generate_seed_population(seed_document)
    return {
        partition["id"]: population[
            partition["offset"] : partition["offset"] + partition["size"]
        ]
        for partition in seed_document["partitions"]
    }


def seed_semantic_issues(seed_document: dict[str, Any]) -> list[str]:
    population = generate_seed_population(seed_document)
    issues: list[str] = []
    if len(set(population)) != len(population):
        issues.append("La règle de construction ne produit pas une population unique.")
    if _canonical_fingerprint(population) != seed_document["population_fingerprint"]:
        issues.append("L'empreinte de la population de seeds est incohérente.")
    for partition in seed_document["partitions"]:
        values = population[partition["offset"] : partition["offset"] + partition["size"]]
        if _canonical_fingerprint(values) != partition["fingerprint"]:
            issues.append(f"L'empreinte de {partition['id']} est incohérente.")
    first, second = seed_document["partitions"]
    if first["offset"] + first["size"] != second["offset"]:
        issues.append("Les partitions de seeds doivent être contiguës et ordonnées.")
    return issues


def _authority_versions(protocol: dict[str, Any], corpus: dict[str, Any]) -> list[str]:
    actual = {
        "corpus": (corpus.get("corpus_id"), corpus.get("schema_version")),
        "normative_contract": (
            corpus.get("normative_contract", {}).get("id"),
            corpus.get("normative_contract", {}).get("version"),
        ),
        "prng": (corpus.get("prng_contract", {}).get("id"), "1.0"),
    }
    return [
        f"Incompatibilité de version pour {name}: attendu {authority['id']} "
        f"{authority['version']}, observé {actual[name][0]} {actual[name][1]}."
        for name, authority in protocol["authorities"].items()
        if name != "seed_population" and actual[name] != (authority["id"], authority["version"])
    ]


def _scenario_issues(
    protocol: dict[str, Any], corpus: dict[str, Any], seed_document: dict[str, Any],
) -> list[str]:
    issues: list[str] = []
    scenarios = protocol["scenarios"]
    scenario_ids = [scenario["id"] for scenario in scenarios]
    if len(set(scenario_ids)) != len(scenario_ids):
        issues.append("Les identifiants de scénarios doivent être uniques.")
    cases = {case["id"]: case for case in corpus.get("cases", [])}
    partition_sizes = {part["id"]: part["size"] for part in seed_document["partitions"]}
    for scenario in scenarios:
        source = cases.get(scenario["source_case_id"])
        if source is None:
            issues.append(f"Scénario {scenario['id']}: cas source absent du corpus.")
        elif source["input"]["mode"] != scenario["mode"]:
            issues.append(f"Scénario {scenario['id']}: mode divergent du cas source.")
        if any(
            scenario["cohort_size"] > partition_sizes[protocol["cohort_assignment"][engine]]
            for engine in ("python", "typescript")
        ):
            issues.append(f"Scénario {scenario['id']}: cohorte hors population versionnée.")
    modes = {scenario["mode"] for scenario in scenarios}
    if modes != {"backlog_to_weeks", "weeks_to_items"}:
        issues.append("Le protocole doit couvrir exactement les deux modes normatifs.")
    has_structural_censor = any(
        scenario["distribution_view"] == "structural-censor-state"
        for scenario in scenarios
    )
    if not has_structural_censor:
        issues.append("Un scénario de censure structurelle est requis.")
    return issues


def _inference_issues(protocol: dict[str, Any]) -> list[str]:
    inference = protocol["inference"]
    inferential_count = sum(
        len(scenario["metrics"])
        for scenario in protocol["scenarios"]
        if scenario["distribution_view"] != "structural-censor-state"
    )
    minimum_permutations = math.ceil(inferential_count / inference["familywise_alpha"]) - 1
    if inference["permutations"] < minimum_permutations:
        return [
            "Le nombre de permutations ne résout pas le plus petit seuil de Holm : "
            f"{inference['permutations']} < {minimum_permutations}."
        ]
    return []


def protocol_semantic_issues(
    protocol: dict[str, Any], corpus: dict[str, Any], seed_document: dict[str, Any],
) -> tuple[list[str], list[str]]:
    version_issues = _authority_versions(protocol, corpus)
    protocol_issues = [
        *seed_semantic_issues(seed_document),
        *_scenario_issues(protocol, corpus, seed_document),
        *_inference_issues(protocol),
    ]
    return version_issues, protocol_issues


def validate_protocol_bundle(
    *,
    protocol_path: Path = PROTOCOL_PATH,
    protocol_schema_path: Path = PROTOCOL_SCHEMA_PATH,
    seeds_path: Path = SEEDS_PATH,
    seeds_schema_path: Path = SEEDS_SCHEMA_PATH,
    corpus_path: Path = CORPUS_PATH,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    protocol = load_json(protocol_path)
    protocol_schema = load_json(protocol_schema_path)
    seeds = load_json(seeds_path)
    seeds_schema = load_json(seeds_schema_path)
    corpus = load_json(corpus_path)
    structural = [
        *schema_issues(protocol, protocol_schema, "protocole"),
        *schema_issues(seeds, seeds_schema, "seeds"),
    ]
    if structural:
        raise ProtocolBundleError("protocol_error", structural)
    version_issues, semantic = protocol_semantic_issues(protocol, corpus, seeds)
    if version_issues:
        raise ProtocolBundleError("version_incompatibility", version_issues)
    if semantic:
        raise ProtocolBundleError("protocol_error", semantic)
    return protocol, seeds, corpus
