# Contrat du corpus de référence statistique

Le PBI 2.9 établit le format sérialisé commun. Le PBI 2.10 matérialise dans ce format les cas normatifs
d’entrées, de modes, de zéros, d’horizon, de censures et de percentiles. Aucun cas n’est encore exécuté
dans un moteur : les runners Python et TypeScript restent réservés au PBI 2.12.

## Autorité et fichiers

Le contrat normatif initial est la version `1.0`, exprimée en JSON Schema draft 2020-12 :

- [`contracts/statistical-reference-corpus-v1.0.schema.json`](../contracts/statistical-reference-corpus-v1.0.schema.json)
  est l’autorité machine, indépendante de Python et TypeScript ;
- [`contracts/statistical-reference-corpus-v1.0.json`](../contracts/statistical-reference-corpus-v1.0.json)
  est le corpus normatif `1.0`, enrichi par les cinq cas du PBI 2.10 ;
- [`contracts/examples/statistical-reference-corpus-v1.0.minimal.json`](../contracts/examples/statistical-reference-corpus-v1.0.minimal.json)
  reste une preuve de structure avec un seul cas trivial ;
- [`contracts/examples/statistical-reference-corpus-v1.0.invalid.json`](../contracts/examples/statistical-reference-corpus-v1.0.invalid.json)
  est un contre-exemple minimal et volontairement invalide ;
- [`contracts/mca-prng-v1-vectors.json`](../contracts/mca-prng-v1-vectors.json) reste l’autorité distincte
  sur les sorties du PRNG et les indices d’échantillonnage.

Un document porte obligatoirement `schema_version = "1.0"`, l’identité stable du corpus, la référence à
`STD-STAT-001` version `1.0`, le contrat `mca-prng-v1` et une liste de cas. Les objets sont fermés par
`additionalProperties: false` à chaque niveau.

## Forme d’un cas

Chaque cas associe sans ambiguïté :

- un identifiant stable, unique dans la version du corpus, et une description lisible ;
- un `proof_level` choisi dans les quatre niveaux de `STAT-PAR-001` : `algorithmic`, `deterministic`,
  `replay` ou `distributional` ;
- une `input` normalisée, sans défaut de transport ni paramètre inactif ;
- une `seed` uint32 résolue dans `0..4294967295`, consommée par `mca-prng-v1` ;
- un `expected_result` exprimé dans la forme normative commune, avant présentation, persistance ou
  diagnostic métier.

Les entrées imposent de 6 à 521 observations entières positives ou nulles, au moins six observations
strictement positives lorsque `include_zero_weeks` vaut `false`, et `n_sims` dans `1000..200000`.
`backlog_to_weeks` exige uniquement `backlog_size` dans `1..1000000`; `weeks_to_items` exige uniquement
`target_weeks` dans `1..521`.

Les résultats n’acceptent que `P50`, `P70` et `P90`, au plus 100 buckets non vides, les quatre labels de
fiabilité normatifs, une seed uint32 et des comptes bornés par les domaines existants. Le mode backlog
impose `result_kind = "weeks"` et `completion_summary`; le mode capacité impose `result_kind = "items"` et
interdit ce résumé.

## Invariants normatifs

JSON Schema 2020-12 exprime directement les types, bornes, champs obligatoires, propriétés fermées,
cardinalités, paramètres actifs et discriminants de mode. Les relations entre valeurs sont aussi consignées
dans le `$comment` normatif de `expectedResult` et restent gouvernées par `STD-STAT-001` :

- la seed du résultat est identique à la seed du cas ;
- `samples_count` est identique dans le résultat et la fiabilité ;
- les percentiles présents sont croissants en mode backlog et décroissants en mode capacité ;
- les abscisses d’histogramme sont strictement croissantes et les comptes conservent la masse attendue ;
- les comptes de complétion totalisent `n_sims`, et le taux de censure applique l’arrondi `round half up`
  à quatre décimales ;
- `risk_score` est omis lorsqu’il n’est pas calculable et suit sinon la formule du mode.

Ces relations arithmétiques ne sont pas remplacées par une extension propriétaire comme `$data` : le
contrat reste lisible par tout validateur standard draft 2020-12. Le contrôle autonome vérifie désormais
les relations structurelles nécessaires au corpus, mais leur exécution dans Python et TypeScript appartient
toujours aux runners du PBI 2.12.

## Cas normatifs du PBI 2.10

Le corpus contient exactement cinq cas 2.10, chacun avec `n_sims = 1000`. Les cas de rejeu consomment
`mca-prng-v1` selon l’ordre simulation-major de `STAT-PAR-003`, `STAT-PAR-004`, `STAT-PAR-018` et
`STAT-PAR-019`. Les cas déterministes utilisent un throughput constant : leur résultat ne dépend donc pas
de l’indice tiré.

| Cas | Règles matérialisées | Résultat 2.10 |
| --- | --- | --- |
| `items-zero-weeks-excluded` | zéro exclu avant calcul, six samples utilisables, `weeks_to_items`, seul `target_weeks` actif | P50 = 3, P70 = 2, P90 = 1 |
| `weeks-zero-weeks-included-no-censorship` | zéro conservé, `backlog_to_weeks`, seul `backlog_size` actif, censure absente | 1 000 fins ; P50 = 2, P70 = 3, P90 = 4 |
| `weeks-exact-horizon-completion` | throughput fixé à 1, backlog 521 | 1 000 fins exactes en semaine 521, aucune censure |
| `weeks-partial-censorship` | un zéro et dix-neuf `1`, backlog 492 | 748 fins, 252 censures ; P50 = 518, P70 = 521, P90 absent |
| `weeks-total-censorship` | throughput fixé à 1, backlog 522 | 0 fin, 1 000 censures ; tous les percentiles absents |

Les champs `risk_score`, `throughput_reliability` et `result_distribution` restent présents lorsque le
schéma et `STD-STAT-001` l’exigent pour former un résultat normatif complet. Le PBI 2.10 ne leur ajoute
aucun scénario limite, aucun calcul spécialisé et aucune revendication de couverture : leurs cas de
référence dédiés restent au PBI 2.11.

## Dérivation explicite des résultats attendus

Les résultats ont été établis depuis `STD-STAT-001` et la récurrence publiée de `mca-prng-v1`, sans appeler
le moteur Python ni le moteur TypeScript. Pour les trois cas de rejeu, une dérivation indépendante et
jetable a appliqué les opérations uint32 du contrat et `floor(value × sampleCount / 2^32)`. Avant tout
calcul statistique, ses 16 premiers indices avec seed `0` et `sampleCount = 6` ont été comparés au vecteur
canonique :

```text
1, 0, 1, 0, 2, 3, 3, 3, 2, 3, 1, 0, 5, 2, 4, 3
```

Cette suite est exactement celle de
[`contracts/mca-prng-v1-vectors.json`](../contracts/mca-prng-v1-vectors.json). La dérivation respecte ensuite
les slots réservés : un slot par simulation pour `target_weeks = 1`, et 521 slots par simulation dans les
cas backlog, même après une fin anticipée.

### `items-zero-weeks-excluded`

Le zéro de `[0, 1, 2, 3, 4, 5, 6]` est retiré conformément à `STAT-PAR-013`; les indices `0..5`
désignent donc les valeurs `1..6`. Le décompte des 1 000 tirages est :

| Items | 1 | 2 | 3 | 4 | 5 | 6 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compte | 157 | 168 | 186 | 164 | 160 | 165 |
| Cumul croissant | 157 | 325 | 511 | 675 | 835 | 1 000 |

Selon `STAT-PAR-023`, le quantile de survie utilise le quantile discret inférieur de niveau
`(100 - p) / 100`. Sur 1 000 valeurs triées, les indices zéro-based sont respectivement
`floor(0,5 × 999) = 499`, `floor(0,3 × 999) = 299` et `floor(0,1 × 999) = 99`. Les 500e, 300e et
100e valeurs sont `3`, `2` et `1`, d’où `P50 = 3 >= P70 = 2 >= P90 = 1`.

### `weeks-zero-weeks-included-no-censorship`

Le zéro de `[0, 1, 2, 3, 4, 5]` reste tirable. Chaque simulation cumule jusqu’au backlog `5`; toutes
finissent avant l’horizon :

| Semaines | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compte | 165 | 413 | 265 | 110 | 35 | 9 | 1 | 2 |
| Cumul | 165 | 578 | 843 | 953 | 988 | 997 | 998 | 1 000 |

Les rangs de `STAT-PAR-021` sont `ceil(0,50 × 1000) = 500`,
`ceil(0,70 × 1000) = 700` et `ceil(0,90 × 1000) = 900`. Ils tombent aux semaines `2`, `3` et `4`,
d’où `P50 = 2 <= P70 = 3 <= P90 = 4`. Le cumul final `1 000` établit la censure absente.

### Fin exacte à l’horizon et censure totale

Avec six valeurs toutes égales à `1`, chaque semaine ajoute exactement un item, quel que soit le tirage :

- backlog `521` : la condition est atteinte pendant la semaine 521. `STAT-PAR-018` impose une fin, donc
  1 000 durées `521`, zéro censure et trois percentiles égaux à `521` ;
- backlog `522` : le cumul maximal à la fin de la semaine 521 vaut `521`. Les 1 000 simulations sont
  censurées selon `STAT-PAR-018`, aucune durée terminée ne subsiste selon `STAT-PAR-020`, et les rangs
  500, 700 et 900 sont tous non identifiables selon `STAT-PAR-022`.

### `weeks-partial-censorship`

Les 20 samples contiennent un zéro puis dix-neuf `1`. Pour la seed `246813579` et le backlog `492`, les
durées terminées issues des lignes de 521 slots sont :

| Semaine | 503 | 504 | 505 | 506 | 507 | 508 | 509 | 510 | 511 | 512 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compte | 1 | 1 | 1 | 3 | 12 | 15 | 17 | 18 | 32 | 46 |
| Cumul | 1 | 2 | 3 | 6 | 18 | 33 | 50 | 68 | 100 | 146 |

| Semaine | 513 | 514 | 515 | 516 | 517 | 518 | 519 | 520 | 521 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Compte | 58 | 54 | 68 | 66 | 60 | 82 | 74 | 82 | 58 |
| Cumul | 204 | 258 | 326 | 392 | 452 | 534 | 608 | 690 | 748 |

Il reste `1000 - 748 = 252` censures, donc `censored_rate = 252 / 1000 = 0,2520`, sérialisé `0.252`.
Le rang 500 se trouve en semaine 518 et le rang 700 en semaine 521. Le rang 900 dépasse les 748 fins :
`P50 = 518`, `P70 = 521` et P90 est omis, sans `null`, zéro ni sentinelle.

## Probes de validation des entrées

Un cas invalide ne peut pas appartenir à `cases` sans rendre le corpus contraire au schéma 2.9. Le contrôle
autonome construit donc, à partir des cas valides, 24 mutations négatives minimales et exige le diagnostic
JSON Schema localisé :

- longueurs de throughput `5` et `522`, sample chaîne, décimal et négatif ;
- seulement cinq samples strictement positifs après exclusion des zéros ;
- type invalide de `include_zero_weeks` et mode hors contrat ;
- `n_sims` à `999` et `200001`, plus une chaîne ;
- `target_weeks` à `0` et `522`, chaîne, absence et présence du `backlog_size` inactif ;
- `backlog_size` à `0` et `1000001`, chaîne, absence et présence du `target_weeks` inactif ;
- seed à `-1` et `4294967296`, plus une chaîne.

Les bornes inclusives opposées sont aussi acceptées explicitement par les tests : historique de 521
valeurs, `n_sims = 200000`, `target_weeks = 521`, `backlog_size = 1000000` et seed `4294967295`. Les
cas normatifs eux-mêmes matérialisent les minima utiles : six samples, `n_sims = 1000`,
`target_weeks = 1` et seed `0`.

## Contrôle autonome

Le contrôle ne charge ni moteur, ni DTO, ni API :

```bash
.venv\Scripts\python.exe Scripts/validate_statistical_reference_corpus.py
```

Le point d’entrée délègue les invariants interchamps et de périmètre à
`Scripts/statistical_reference_corpus_invariants.py` afin de conserver des contrôles courts et auditables ;
ce module ne dépend lui non plus d’aucun moteur.

Il valide le métaschème et le corpus, vérifie la complétude du périmètre 2.10, exécute les 24 probes
d’entrées, contrôle les invariants interchamps structurels, accepte l’exemple positif et exige le rejet du
contre-exemple. Ce rejet doit désigner `/cases/0/input` avec le mot-clé `additionalProperties`. Des corpus
candidats peuvent être fournis en arguments. Chaque erreur contient le fichier, un JSON Pointer d’instance,
le mot-clé en défaut, un message et le JSON Pointer du schéma, par exemple :

```text
candidate.json:/cases/0/seed: [maximum] 4294967296 is greater than the maximum of 4294967295
```

Le chargeur refuse aussi les propriétés JSON dupliquées avant la validation, car un parseur JSON ordinaire
les écraserait avant que JSON Schema puisse les observer.

## Évolution

La version `1.0` est immuable. Toute évolution incompatible des entrées, de la seed, des résultats ou du
niveau de preuve requiert une nouvelle version normative et une décision de compatibilité conforme à
`STAT-PAR-048`. Ce versionnement du corpus ne modifie aucun DTO, payload API, document MongoDB ni objet
`localStorage`.
