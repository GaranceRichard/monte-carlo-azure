# État consolidé des garanties statistiques

- Verdict consolidé : `match`
- Enforcement courant : `blocking_in_main` par la politique versionnée.
- Contrat normatif : `STD-STAT-001` version `1.0`.
- Corpus : `mca-statistical-reference-corpus` version `1.0`.
- Protocole distributionnel : `mca-statistical-distributional-parity` version `1.0`.
- Empreinte du contenu : `01da4804ce8b6588295446b1f652e73b04088a54801c871dd6c76a73069471bd`.
- Empreinte des sources : `6c22616bbf9b026fb796b21a3d96a3f4ecf7d4cc709fa42e50f8b01dc58b6ff2`.

Le verdict applique la priorité documentée sans fusionner les niveaux de preuve. Un rejeu exact conforme n’annule donc ni un résultat distributionnel non concluant, ni une divergence ou une preuve invalide.

## Ce qui est démontré

| Niveau de preuve | Statut | Source | Périmètre | Compteurs |
| --- | --- | --- | --- | --- |
| `algorithmic_normative_compliance` | `match` | `deterministic_parity` | Versioned corpus expected results in both declared engines. | cases=16, matches=16, normative_divergences=0, engine_errors=0 |
| `contract_and_probe_validation` | `match` | `deterministic_parity` | Closed input contract and shared validation probes. | probes=22, matches=22, divergences=0, engine_errors=0 |
| `exact_interlanguage_replay` | `match` | `exact_replay` | Exact canonical replay against corpus 1.0 and between declared languages. | cases=16, normative_comparisons=80, normative_matches=80, interlanguage_comparisons=64, interlanguage_matches=64 |
| `batching_independence` | `match` | `exact_replay` | Python batch sizes declared by exact-replay evidence. | cases=16, independent_cases=16, python_executions=64 |
| `distributional_parity` | `match` | `distribution_evidence` | Protocol 1.0 scenarios, cohorts, metrics, margins and documented power. | scenarios=5, metrics=49, matches=49, divergences=0, inconclusive=0 |
| `statistical_compatibility` | `match` | `compatibility_evidence` | Versioned semantic authorities, decisions, proofs, and historical-data treatments. | components=15, matching_components=15, proofs=8, matching_proofs=8, diagnostics=0 |

## Compatibilité statistique

- Statut : `match`.
- Autorité : `mca-statistical-compatibility-authority` version `1.0`.
- Exécution directe et intégration au profil `main` : bloquantes.
- Composants conformes : 15/15.
- Preuves conformes : 8/8.
- Diagnostics : 0.

## Sources vérifiées

| Source | Version déclarée | Validation | SHA-256 | Empreinte canonique |
| --- | --- | --- | --- | --- |
| `normative_standard` | `1.0` | `valid` | `a22852843085f0a073ef42bebc7d3ab63e0cc009e342ecd177e2493e5bbcd6eb` | `non fournie` |
| `prng_vectors` | `1.0` | `valid` | `fd405aab04b04ba34e3372a2a581f504bfa501cca925055e20f655f1fda29826` | `non fournie` |
| `reference_corpus` | `1.0` | `valid` | `c81c699319faef4ded0cb9fe974fad76d22ecd9a661ce807d581cb3acc04c49d` | `non fournie` |
| `validation_probes` | `1.0` | `valid` | `1dbdd37dbd4bd068bb18372ba7292eef01f3fbaba9f12cfb798d359aa9ef1e3c` | `non fournie` |
| `deterministic_parity` | `1.1` | `valid` | `d20c374c00861286083a084c2e0e8280b3725b6d847317f7cccd4b7435d95ba8` | `non fournie` |
| `exact_replay` | `1.0` | `valid` | `22dbac8b9f4b02cc6d7054a9410b8bdd2a05dae8946d21ad7c7b6915bac2e080` | `non fournie` |
| `distribution_protocol` | `1.0` | `valid` | `c90ea0ff645cd8928562b2a71bfaf2d942a13a91336a512c99525b807da417b5` | `non fournie` |
| `distribution_seed_population` | `1.0` | `valid` | `e9a350d7eabafe682b34e97817573e2dbbe52403565af830afeefd57092098cf` | `889e757eab13c3766225989e5df3660affccd90dddc91d9314e7b0e3e4a621e9` |
| `distribution_calibration` | `1.0` | `valid` | `6e451e2e32254dbfcebb3545942c4edbb5e5a1f530b2d308d6cc4c26ce8bf8b3` | `6a86b14a6ab9d6cc40b6b357220126a038a6f47b37619e10653ff03be988d7be` |
| `distribution_evidence` | `1.0` | `valid` | `00ff236fecacfea260dbb1bb7191635f03f25e644e1cca42764081a34febbce7` | `f464e271f8c1eaa44aa1cb859ebefa0179de7196be5ff37073efb858b02aa756` |
| `compatibility_evidence` | `1.0` | `valid` | `e1fddad48a4c9ec96336400844dd08d9cc528823b9fbf574f4ff658497a80cc1` | `85d3737cfe750094fbda2c0138ce3e12087bf552ce6f504fab301f40e5dc9a99` |

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
- `statistical_compatibility` — In main, this validated run-scoped proof is blocking; its scope remains the declared authorities, versions, decisions, and evidence.
- `azure_devops_empirical_backtesting` — No empirical Azure DevOps backtesting is evaluated.
- `universal_equivalence` — No equivalence is claimed outside recorded corpus cases and protocol scenarios.

## Interprétation

Le rejeu exact porte uniquement sur le corpus et les versions déclarées. La preuve distributionnelle porte uniquement sur ses scénarios, cohorts, métriques, marges et puissance documentés ; elle ne devient jamais une preuve exacte. L’absence de divergence ne démontre pas une équivalence universelle.

Ces preuves ne constituent pas un backtesting empirique Azure DevOps. Les dérives de version et décisions de compatibilité sont contrôlées par la preuve spécialisée ; le profil `main` bloque toute preuve obligatoire absente, invalide ou non conforme.
