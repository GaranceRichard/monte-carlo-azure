# Compatibilité et dérives statistiques

Ce document décrit l’autorité machine et le contrôle bloquant qui protègent l’interprétation et le rejeu
des résultats statistiques. Les règles statistiques restent dans
[`STD-STAT-001`](standards/STD-STAT-001.md) ; l’autorité fermée est
[`statistical-compatibility-authority-v1.0.json`](../contracts/statistical-compatibility-authority-v1.0.json),
validée par son [JSON Schema](../contracts/statistical-compatibility-authority-v1.0.schema.json).

Le contrôle s’exécute directement avec :

```powershell
.venv\Scripts\python.exe Scripts/run_statistical_compatibility.py
.venv\Scripts\python.exe Scripts/validate_statistical_compatibility_evidence.py
```

La première commande est bloquante : toute dérive, décision incohérente, preuve périmée ou autorité
illisible retourne un code non nul. Dans le profil `main`, elle reçoit explicitement les preuves du run déjà
validées ; l’attestation de compatibilité les lie au même snapshot et à la politique fermée.

## Inventaire des surfaces, autorités, consommateurs et preuves

Chaque surface appartient exactement à un composant versionné. Les chemins et sélecteurs exhaustifs sont
dans l’autorité JSON ; le tableau explicite leur rôle opérationnel. `Corpus` désigne le corpus 1.0,
`sondes` ses 22 sondes, `parité` le rapport déterministe 1.1, `exact` la preuve de rejeu 1.0 et `dist.` le
protocole, la calibration et la preuve distributionnelle 1.0.

| Surface normative | Composant / version | Autorités sémantiques principales | Consommateurs | Preuves obligatoires |
| --- | --- | --- | --- | --- |
| Validation et normalisation des entrées | `input-contract` 1.0 | `STAT-PAR-011..016`, limites, Value Objects et fabriques Python/TypeScript, schéma d’entrée | API, moteurs, runners | sondes, parité, exact |
| Valeurs par défaut résolues | `resolved-defaults` 1.1 | `STAT-PAR-017`, `SimulateRequest`, `localTeamForecast.simulateForecastFromSamples` | API, contrat `TeamForecast`, commande moteur | sondes, parité |
| Domaine et résolution de la seed | `seed-contract` 1.0 | `STAT-PAR-006..010`, bornes uint32, résolveurs et Value Objects | API, UI, moteurs, historiques, rejeu | sondes, parité, exact, dist. |
| PRNG | `prng` 1.0 / `mca-prng-v1` | `STAT-PAR-003`, vecteurs, ports Python/TypeScript | moteurs, dérivation du corpus, rejeu | Corpus, parité, exact, calibration, dist. |
| Conversion tirage–index | `prng` 1.0 / `mca-prng-v1` | multiplication haute uint32 et conversion TypeScript correspondante | ports de tirage des deux moteurs | Corpus, parité, exact, calibration, dist. |
| Ordre logique des tirages | `draw-order-and-batching` 1.0 | `STAT-PAR-004`, matrices simulation-major, boucles et skip TypeScript | moteurs, rejeu | Corpus, parité, exact |
| Batching | `draw-order-and-batching` 1.0 | taille, découpage et géométries Python ; séquence logique TypeScript | moteur Python, preuve exacte | Corpus, parité, exact |
| Modes et conditions d’arrêt | `simulation-modes` 1.0 | `STAT-PAR-018..019`, moteurs et orchestration | API, moteurs, corpus | Corpus, parité, exact, dist. |
| Censure | `censorship-and-percentiles` 1.0 | `STAT-PAR-020..022`, population complétée/censurée et résumé | moteurs, score, historiques, rapports | Corpus, parité, exact, dist. |
| P50, P70 et P90 | `censorship-and-percentiles` 1.0 | `STAT-PAR-021..025`, rang total et quantiles de survie | moteurs, score, API, rapports | Corpus, parité, exact, dist. |
| Risk Score | `risk-score` 1.0 | `STAT-PAR-026..029`, garde d’absence, formule et `round half up` | moteurs, API, historique, UI, PDF | Corpus, parité, exact, dist. |
| Métriques et labels de fiabilité | `throughput-reliability` 1.0 | `STAT-PAR-030..035`, métriques, arrondi, seuils et priorité | moteurs, API, historique, UI | Corpus, parité, exact, dist. |
| Histogrammes | `histogram` 1.0 | `STAT-PAR-036..039`, builders et validateurs de buckets | moteurs, API, historiques, graphiques | Corpus, parité, exact, dist. |
| Forme canonique de réponse | `canonical-response` 1.0 | `STAT-PAR-040..043`, modèles, DTO, mappers et schéma `expectedResult` | API, frontend, corpus, historique | Corpus, sondes, parité, exact |
| Présence ou absence des champs | `canonical-response` 1.0 | modèles fermés, omission de `risk_score`, percentiles et `completion_summary` | API, stockage, rapports | Corpus, sondes, parité, exact |
| Sérialisation des résultats | `serialization-and-history` 2.0 | mappers Python/TypeScript et DTO de stockage | MongoDB, `localStorage`, exports | parité, exact |
| Schémas du corpus | `reference-corpus-contract` 1.0 | schémas fermés du corpus et des sondes | validateur, runners, protocoles | Corpus, sondes, parité, exact, dist. |
| Résultats attendus du corpus | `reference-corpus-contract` 1.0 | `cases[*].expected_result`, entrées et seeds associées | moteurs, rejeu, parité | Corpus, parité, exact, dist. |
| Sondes de validation | `reference-corpus-contract` 1.0 | schéma et 22 verdicts partagés | fabriques Python/TypeScript | sondes, parité |
| Protocole de rejeu exact | `exact-replay-proof` 1.0 | schéma, comparateurs, couverture et géométries de batch | revue, compatibilité, consolidation | Corpus, parité, exact |
| Protocole de parité distributionnelle | `distributional-proof` 1.0 | protocole, seeds, schémas, statistiques, calibration et runner | revue, compatibilité, consolidation | protocole, seeds, calibration, dist. |
| Données persistées et historiques | `serialization-and-history` 2.0 | document Mongo, DTO local `schemaVersion: 2`, lecteurs legacy | API d’historique, restauration locale | parité, exact |
| Caches, exports et artefacts de rejeu | `serialization-and-history` 2.0 | formes stockées, rapports/exportations et preuves versionnées | UI, PDF, revue et consolidation | parité, exact |

## Méthode d’empreinte sémantique

`mca-semantic-authority-extraction` version 1.0 produit un JSON canonique trié, encodé en UTF-8 compact,
puis un SHA-256. L’unité extraite dépend de l’autorité :

- Python : AST des symboles nommés, sans positions, commentaires ni docstrings ;
- TypeScript : déclarations nommées tokenisées après retrait lexical des commentaires ; les chaînes restent
  significatives, les espaces et commentaires ne le sont pas ;
- Markdown : sections `STAT-PAR-*` explicitement sélectionnées, normalisées seulement sur les espaces ;
- JSON : valeurs aux JSON Pointers déclarés, avec objets triés ; seuls `$comment`, `description`, `examples`
  et `title` sont descriptifs et ignorés.

Le hash complet d’un fichier source n’est donc jamais l’unique oracle. Une note descriptive ou un
commentaire n’ouvre pas une incompatibilité ; une constante, une branche, un type, un champ, une formule,
une règle normative ou un résultat attendu la déclenche. Un fichier absent, un JSON dupliqué ou invalide,
un symbole absent ou défini plusieurs fois, une chaîne ou un commentaire TypeScript non terminé et une
section normative ambiguë produisent `compatibility_control_error`.

L’extraction répétée doit produire les mêmes empreintes. Les empreintes acceptées vivent dans une lignée de
releases : modifier une valeur attendue sans aligner la release et sa décision ne masque pas la dérive. Une
fois l’autorité suivie par Git, le contrôle relit aussi sa version `HEAD` : les releases acceptées sont
immuables, une modification du manifeste exige une release ajoutée, et toute preuve requise par cette release
doit être régénérée et versionnée. Le seul cas sans antécédent Git est l’adoption initiale de l’autorité.

## Classification fermée et décisions

| Classification | Sens et décision attendue |
| --- | --- |
| `no_normative_impact` | Empreinte observée identique ; aucune évolution normative. |
| `compatible_without_historical_result_change` | Évolution explicite qui ne modifie aucun résultat historique. |
| `compatible_contract_extension` | Extension lisible par les consommateurs existants, avec version et preuves. |
| `normative_result_change` | Tirage, censure, percentile, score, label ou histogramme potentiellement différent. |
| `replay_incompatibility` | Une seed et une entrée anciennes ne garantissent plus le même résultat. |
| `pseudo_random_stream_change` | Le flux ou tirage–index change ; une nouvelle identité PRNG est obligatoire. |
| `serialized_shape_change` | Présence, type ou forme JSON change. |
| `migration_required` | Les données existantes exigent une transformation déterministe prouvée. |
| `invalidation_required` | Les données ou caches ne peuvent rester des références courantes. |
| `decision_missing` | Une release ou une surface changée n’a pas de décision complète. |
| `version_not_incremented` | Une empreinte sémantique change sous la même version. |
| `corpus_or_proof_not_updated` | Corpus, sonde, protocole ou preuve est absent, périmé ou incohérent. |
| `compatibility_control_error` | Le contrôle ne peut analyser une autorité ou valider sa propre preuve. |

Une release non initiale doit être strictement supérieure, chaîner version et empreinte précédentes,
énumérer les surfaces modifiées, expliquer la décision, pointer sa traçabilité, lister les preuves exigées et
traiter chaque catégorie historique affectée. Un changement de flux pseudo-aléatoire sous la même identité
est toujours refusé. Le vert des tests existants, le seul corpus ou les deux moteurs modifiés ensemble ne
constituent jamais une décision.

Le PBI 7.19 publie la release append-only `resolved-defaults` 1.1. Elle rattache l’autorité TypeScript à
`application/team-forecast/localTeamForecast.ts:simulateForecastFromSamples` après le retrait de la façade
cyclique, sans modifier les valeurs par défaut ni les résultats historiques. Les sondes de validation 1.1 et
la parité déterministe 1.2 ont été régénérées et restent identiques sur 22 sondes et 16 cas ; les résultats
seedés conservent donc le traitement `compatible_without_action`.

## Historique, caches et artefacts

Les sept catégories fermées sont `backend_history`, `local_history`, `runtime_caches`,
`reports_and_exports`, `generated_proofs`, `seeded_results` et `replay_artifacts`. Chaque catégorie affectée
doit recevoir exactement un traitement parmi : compatibilité sans action, migration déterministe, lecture
legacy sans nouveau rejeu, invalidation, purge, archivage avec ancienne version ou rejet explicite.

La release initiale constate les formats actuels : historique Mongo sans version de schéma propre,
historique local `schemaVersion: 2`, résultats et seeds, rapports/exportations, preuves et artefacts de
rejeu. Toutes les décisions initiales sont `compatible_without_action`, car le PBI 2.20 ne modifie aucun
calcul ni format produit. Aucune migration, purge ou invalidation de donnée réelle n’est exécutée.

## Preuve et diagnostic

[`statistical-compatibility-evidence.json`](../reports/statistical-compatibility-evidence.json) est une preuve
fermée, stable et auto-empreintée. Elle publie l’autorité, les 15 composants, les 23 surfaces, les 8 preuves,
les traitements historiques et tout diagnostic. Une dérive précise composant, versions, surface, chemin
d’autorité, empreintes, classification, décision attendue et déclarée, preuves manquantes, données touchées
et action corrective.

Le [rapport consolidé](statistical-consolidated-report.md) consomme cette preuve comme source spécialisée et
expose un sixième niveau `statistical_compatibility`. Dans `main`, la compatibilité précède obligatoirement
la génération du rapport et son échec empêche le consommateur de produire un faux succès. Le détail de cette
chaîne est dans [`statistical-main-enforcement.md`](statistical-main-enforcement.md).
