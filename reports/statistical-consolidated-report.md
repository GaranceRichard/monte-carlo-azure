# État consolidé des garanties statistiques

- Verdict consolidé : `match`
- Enforcement courant : `informational` ; ce rapport n’est pas un contrôle bloquant.
- Contrat normatif : `STD-STAT-001` version `1.0`.
- Corpus : `mca-statistical-reference-corpus` version `1.0`.
- Protocole distributionnel : `mca-statistical-distributional-parity` version `1.0`.
- Empreinte du contenu : `751c5d6a684d90861c9a70a1734b834506eaf25efe2cd252162a7e47fb9c4c2e`.
- Empreinte des sources : `263fd524df56ef005633b21b417f77a1d7bc558fb4efb4956124d30a6248dc79`.

Le verdict applique la priorité documentée sans fusionner les niveaux de preuve. Un rejeu exact conforme n’annule donc ni un résultat distributionnel non concluant, ni une divergence ou une preuve invalide.

## Ce qui est démontré

| Niveau de preuve | Statut | Source | Périmètre | Compteurs |
| --- | --- | --- | --- | --- |
| `algorithmic_normative_compliance` | `match` | `deterministic_parity` | Versioned corpus expected results in both declared engines. | cases=16, matches=16, normative_divergences=0, engine_errors=0 |
| `contract_and_probe_validation` | `match` | `deterministic_parity` | Closed input contract and shared validation probes. | probes=22, matches=22, divergences=0, engine_errors=0 |
| `exact_interlanguage_replay` | `match` | `exact_replay` | Exact canonical replay against corpus 1.0 and between declared languages. | cases=16, normative_comparisons=80, normative_matches=80, interlanguage_comparisons=64, interlanguage_matches=64 |
| `batching_independence` | `match` | `exact_replay` | Python batch sizes declared by exact-replay evidence. | cases=16, independent_cases=16, python_executions=64 |
| `distributional_parity` | `match` | `distribution_evidence` | Protocol 1.0 scenarios, cohorts, metrics, margins and documented power. | scenarios=5, metrics=49, matches=49, divergences=0, inconclusive=0 |

## Sources vérifiées

| Source | Version déclarée | Validation | SHA-256 | Empreinte canonique |
| --- | --- | --- | --- | --- |
| `normative_standard` | `1.0` | `valid` | `353454806bf873de8eaec7dfaec0f87b759eef14524072655750106af5b6e4f0` | `non fournie` |
| `prng_vectors` | `1.0` | `valid` | `fd405aab04b04ba34e3372a2a581f504bfa501cca925055e20f655f1fda29826` | `non fournie` |
| `reference_corpus` | `1.0` | `valid` | `c81c699319faef4ded0cb9fe974fad76d22ecd9a661ce807d581cb3acc04c49d` | `non fournie` |
| `validation_probes` | `1.0` | `valid` | `1dbdd37dbd4bd068bb18372ba7292eef01f3fbaba9f12cfb798d359aa9ef1e3c` | `non fournie` |
| `deterministic_parity` | `1.1` | `valid` | `d20c374c00861286083a084c2e0e8280b3725b6d847317f7cccd4b7435d95ba8` | `non fournie` |
| `exact_replay` | `1.0` | `valid` | `1261606e510f363187d28dd3980ccaa8a5183176e08978c18662e1c93c66a606` | `non fournie` |
| `distribution_protocol` | `1.0` | `valid` | `c90ea0ff645cd8928562b2a71bfaf2d942a13a91336a512c99525b807da417b5` | `non fournie` |
| `distribution_seed_population` | `1.0` | `valid` | `e9a350d7eabafe682b34e97817573e2dbbe52403565af830afeefd57092098cf` | `889e757eab13c3766225989e5df3660affccd90dddc91d9314e7b0e3e4a621e9` |
| `distribution_calibration` | `1.0` | `valid` | `d11ea89dbe4514b229d57cc11f52a745823430892619609e638d189603521f58` | `6a86b14a6ab9d6cc40b6b357220126a038a6f47b37619e10653ff03be988d7be` |
| `distribution_evidence` | `1.0` | `valid` | `b6cb2d7754e1a63afa11db1731d89606a77abcfc8dc5e9f217e5ef42a755fd54` | `f464e271f8c1eaa44aa1cb859ebefa0179de7196be5ff37073efb858b02aa756` |

## Cas normatifs et rejeu exact

| Cas | Famille | Corpus / moteurs | Rejeu exact | Batch indépendant |
| --- | --- | --- | --- | --- |
| `items-zero-weeks-excluded` | `replay` | `match` | `match` | `oui` |
| `weeks-zero-weeks-included-no-censorship` | `replay` | `match` | `match` | `oui` |
| `weeks-exact-horizon-completion` | `deterministic` | `match` | `match` | `oui` |
| `weeks-partial-censorship` | `replay` | `match` | `match` | `oui` |
| `weeks-total-censorship` | `deterministic` | `match` | `match` | `oui` |
| `risk-p50-zero-absent` | `deterministic` | `match` | `match` | `oui` |
| `reliability-slope-005-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-slope-010-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-slope-minus-015-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-cv-050-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-cv-100-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-cv-150-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-iqr-050-rounded` | `replay` | `match` | `match` | `oui` |
| `reliability-seven-observations-degraded` | `replay` | `match` | `match` | `oui` |
| `histogram-aggregated-contiguous-101` | `replay` | `match` | `match` | `oui` |
| `histogram-aggregated-discontinuous` | `replay` | `match` | `match` | `oui` |

## Scénarios distributionnels

| Scénario | Cas source | Cohorte | Simulations | Vue | Statut | Métriques |
| --- | --- | ---: | ---: | --- | --- | --- |
| `items-discrete-exact` | `items-zero-weeks-excluded` | 64 | 4000 | `exact-outcome-cdf` | `match` | 10 (10 match, 0 divergence, 0 non concluante) |
| `items-histogram-aggregated` | `histogram-aggregated-discontinuous` | 128 | 4000 | `reported-histogram-cdf` | `match` | 10 (10 match, 0 divergence, 0 non concluante) |
| `weeks-no-censorship` | `weeks-zero-weeks-included-no-censorship` | 64 | 2000 | `exact-outcome-cdf` | `match` | 11 (11 match, 0 divergence, 0 non concluante) |
| `weeks-partial-censorship` | `weeks-partial-censorship` | 64 | 1000 | `exact-outcome-cdf` | `match` | 11 (11 match, 0 divergence, 0 non concluante) |
| `weeks-total-censorship` | `weeks-total-censorship` | 8 | 1000 | `structural-censor-state` | `match` | 7 (7 match, 0 divergence, 0 non concluante) |

## Diagnostics structurés

Aucun diagnostic spécialisé ou d’intégrité.

## Limites préservées et hors preuve

- `algorithmic_normative_compliance` — Corpus 1.0 only; no claim for inputs or versions outside that corpus.
- `contract_and_probe_validation` — Probe acceptance does not prove statistical equivalence.
- `exact_interlanguage_replay` — Exact replay applies only to the corpus and declared versions.
- `batching_independence` — Independence is not extrapolated beyond the recorded batch geometries.
- `distributional_parity` — Distributional evidence is not exact replay and is bounded by documented power.
- `azure_devops_empirical_backtesting` — No empirical Azure DevOps backtesting is evaluated.
- `universal_equivalence` — No equivalence is claimed outside recorded corpus cases and protocol scenarios.
- `future_version_compatibility` — No compatibility decision or migration for future versions is evaluated.
- `blocking_main_enforcement` — Complete blocking enforcement in main remains outside this report.

## Interprétation

Le rejeu exact porte uniquement sur le corpus et les versions déclarées. La preuve distributionnelle porte uniquement sur ses scénarios, cohorts, métriques, marges et puissance documentés ; elle ne devient jamais une preuve exacte. L’absence de divergence ne démontre pas une équivalence universelle.

Ces preuves ne constituent pas un backtesting empirique Azure DevOps. La décision de compatibilité des futures versions reste hors périmètre, et l’enforcement complet dans le profil `main` appartient au PBI 2.21.
