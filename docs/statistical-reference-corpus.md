# Contrat du corpus de référence statistique

Ce document explique la forme, les dérivations indépendantes, la validation et l’exécution du corpus
statistique partagé. Le [standard `STD-STAT-001`](standards/STD-STAT-001.md) reste l’autorité normative ;
les fichiers JSON décrits ci-dessous sont les autorités machine. L’état observable des moteurs appartient au
[rapport de parité](../reports/statistical-parity-report.md).

## Autorité et fichiers

Le contrat normatif initial est la version `1.0`, exprimée en JSON Schema draft 2020-12 :

- [`contracts/statistical-reference-corpus-v1.0.schema.json`](../contracts/statistical-reference-corpus-v1.0.schema.json)
  est l’autorité machine, indépendante de Python et TypeScript ;
- [`contracts/statistical-reference-corpus-v1.0.json`](../contracts/statistical-reference-corpus-v1.0.json)
  est le corpus normatif `1.0`, formé de cinq cas d’entrées et de modes, dix cas de Risk Score, fiabilité
  et histogrammes, puis d’un cas complémentaire à sept observations ;
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
les relations structurelles nécessaires au corpus avant que le coordinateur autorise l’un ou l’autre
moteur à exécuter un cas.

## Cas normatifs des entrées, modes, censures et percentiles

Le corpus contient exactement cinq cas de cette famille, chacun avec `n_sims = 1000`. Les cas de rejeu consomment
`mca-prng-v1` selon l’ordre simulation-major de `STAT-PAR-003`, `STAT-PAR-004`, `STAT-PAR-018` et
`STAT-PAR-019`. Les cas déterministes utilisent un throughput constant : leur résultat ne dépend donc pas
de l’indice tiré.

| Cas | Règles matérialisées | Résultat attendu |
| --- | --- | --- |
| `items-zero-weeks-excluded` | zéro exclu avant calcul, six samples utilisables, `weeks_to_items`, seul `target_weeks` actif | P50 = 3, P70 = 2, P90 = 1 |
| `weeks-zero-weeks-included-no-censorship` | zéro conservé, `backlog_to_weeks`, seul `backlog_size` actif, censure absente | 1 000 fins ; P50 = 2, P70 = 3, P90 = 4 |
| `weeks-exact-horizon-completion` | throughput fixé à 1, backlog 521 | 1 000 fins exactes en semaine 521, aucune censure |
| `weeks-partial-censorship` | un zéro et dix-neuf `1`, backlog 492 | 748 fins, 252 censures ; P50 = 518, P70 = 521, P90 absent |
| `weeks-total-censorship` | throughput fixé à 1, backlog 522 | 0 fin, 1 000 censures ; tous les percentiles absents |

Les champs `risk_score`, `throughput_reliability` et `result_distribution` restent présents lorsque le
schéma et `STD-STAT-001` l’exigent pour former un résultat normatif complet. Cette famille ne leur ajoute
aucun scénario limite ni aucune revendication de couverture. La famille suivante réutilise sans modifier
deux preuves déjà minimales et discriminantes : le score `0.6667` et l’histogramme exact
de `items-zero-weeks-excluded`, puis l’absence de score avec P90 non identifiable dans
`weeks-partial-censorship`.

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

## Cas normatifs du Risk Score, de la fiabilité et des histogrammes

Les dix nouveaux cas utilisent `n_sims = 1000`, `target_weeks = 1` et la seed `0`. Ce choix rend chaque
tirage égal à un sample utilisable et garde les distributions lisibles. La récurrence indépendante employée
pour la première famille est réutilisée sans importer un moteur ; ses indices sont de nouveau contrôlés contre le
vecteur canonique avant de calculer les comptes.

| Cas | Frontière isolée | Attendu discriminant |
| --- | --- | --- |
| `risk-p50-zero-absent` | garde `P50 > 0`, moyenne nulle | P50/P70/P90 = 0, score absent, `non fiable` |
| `reliability-slope-005-rounded` | `slope_norm = 0.0500` | `incertain` |
| `reliability-slope-010-rounded` | `slope_norm = 0.1000` | `fragile` |
| `reliability-slope-minus-015-rounded` | `slope_norm = -0.1500` | `non fiable` par priorité |
| `reliability-cv-050-rounded` | `cv = 0.5000` seul | `incertain` |
| `reliability-cv-100-rounded` | `cv = 1.0000` seul | `fragile` |
| `reliability-cv-150-rounded` | `cv = 1.5000` seul | `non fiable` |
| `reliability-iqr-050-rounded` | `iqr_ratio = 0.5000` seul | `incertain` |
| `histogram-aggregated-contiguous-101` | 101 valeurs continues, `iqr_ratio = 1.0000` | 51 buckets de largeur 2, `fragile` |
| `histogram-aggregated-discontinuous` | `0..99` puis `10000` | représentants 50 et 9999 |

Les cas ne dupliquent aucune paire entrée normalisée/seed du corpus. Le contrôle autonome refuse désormais
aussi deux identifiants différents qui décriraient le même scénario.

### Risk Score calculé et absent

Trois gardes complémentaires sont protégées :

- dans le cas `items-zero-weeks-excluded`, `P50 = 3` et `P90 = 1`, donc
  `roundHalfUp((3 - 1) / 3, 4) = 0.6667` en mode capacité ; cette valeur matérialise aussi l’écart historique
  ST-25 entre flottant natif et valeur normative arrondie ;
- dans `weeks-partial-censorship`, P50 existe mais P90 n’est pas identifiable : `risk_score` est omis. Cette
  absence matérialise ST-24 et D-02, où l’ancien chemin TypeScript pouvait transformer P90 absent en zéro ;
- dans `risk-p50-zero-absent`, P50 et P90 valent zéro : la garde `P50 > 0` échoue et le score reste absent,
  sans être transformé en score nul.

Le validateur recalcule la formule depuis les percentiles attendus, applique `round half up` à quatre
décimales et vérifie à la fois la valeur et la présence conditionnelle du champ.

### Seuils de fiabilité après arrondi normatif

Toutes les métriques sont dérivées des samples d’entrée, jamais de la sortie d’un helper moteur. Le
validateur recalcule moyenne, variance de population, quantiles linéaires, pente des moindres carrés et
normalisation avec une précision décimale suffisante, normalise à quatre décimales, puis classe dans l’ordre
de `STAT-PAR-033`.

Les trois suites arithmétiques ont une moyenne de `20`. Leurs pentes sont respectivement `1`, `2` et `-3`,
donc les pentes normalisées exactes sont `0.05`, `0.10` et `-0.15`. Les deux premières matérialisent D-03 :
les moteurs historiques exposaient la même valeur arrondie mais choisissaient des labels différents en
comparant auparavant leurs flottants bruts. La référence impose `incertain`, puis `fragile`. La troisième
impose `non fiable` avant toute catégorie de priorité inférieure.

Les cas de coefficient de variation placent huit valeurs `a` et deux valeurs hautes symétriques, ce qui
annule la pente et garde l’IQR nul :

| Samples | Moyenne | Écart-type population | CV | Label |
| --- | ---: | ---: | ---: | --- |
| huit `3`, deux `8` | 4 | 2 | 0.5000 | `incertain` |
| huit `1`, deux `6` | 2 | 2 | 1.0000 | `fragile` |
| huit `1`, deux `16` | 4 | 6 | 1.5000 | `non fiable` |

Pour `reliability-iqr-050-rounded`, les trois occurrences de `3`, `4` et `5` donnent `Q25 = 3`,
médiane `4`, `Q75 = 5` et `(5 - 3) / 4 = 0.5000`; le CV `0.2041` et la pente normalisée `0.0083`
restent sous leurs seuils. Pour `0..100`, `Q25 = 25`, médiane `50`, `Q75 = 75`, donc
`iqr_ratio = 1.0000` et le label est `fragile`. Les cas préservés de la première famille complètent les
quatre labels :
l’historique constant de six valeurs est dégradé en `incertain`, tandis que la censure partielle conserve
un résultat `fiable`.

La preuve `items-zero-weeks-excluded` isole aussi les conventions sur six observations avec `1..6`.
La moyenne vaut `7/2`, la variance de population `35/12`, et les positions `1,25/2,5/3,75` donnent
`Q25 = 9/4`, médiane `7/2` et `Q75 = 19/4`. Avec `x = 0..5`, la pente des moindres carrés vaut `1`.
On obtient donc `cv = 0.4880`, `iqr_ratio = 5/7 = 0.7143` et
`slope_norm = 2/7 = 0.2857`; le label `fragile` reste prioritaire sur la dégradation réservée à un
résultat autrement `fiable`.

Le cas complémentaire `reliability-seven-observations-degraded` utilise les samples
`9,9,10,10,10,11,11`, la moyenne vaut `10` et la variance de population vaut `4/7`; le CV est donc
`sqrt(4/7) / 10 = 0.075592...`, normalisé à `0.0756`. Les positions de quartile `1.5/3/4.5` donnent
`Q25 = 9.5`, médiane `10`, `Q75 = 10.5`, soit `iqr_ratio = 0.1000`. Avec `x = 0..6`, le dénominateur
de régression vaut `28`, le numérateur `10`, la pente `5/14` et `slope_norm = 1/28 = 0.035714...`,
normalisé à `0.0357`. Ces trois métriques seraient `fiable`; les sept observations imposent la dégradation
finale en `incertain`.

Le rejeu de cette référence n’est pas issu d’un moteur. La récurrence scalaire `mca-prng-v1`, vérifiée
contre ses vecteurs contractuels, donne pour les sept indices les comptes
`130/145/150/162/129/147/137`. Leur regroupement sur les valeurs dupliquées donne les buckets
`9:275`, `10:441`, `11:284`, puis P50/P70/P90 `10/10/9`. Les invariants figent à la fois cette
dérivation et les métriques ci-dessus.

### Histogrammes exacts, agrégés, masse et représentants

L’histogramme exact préservé de `items-zero-weeks-excluded` contient les six valeurs `1..6`, dans l’ordre,
avec les comptes `157, 168, 186, 164, 160, 165`. Il conserve une masse de `1000` et reste sous la frontière
de 100 valeurs distinctes de `STAT-PAR-037`.

Pour `histogram-aggregated-contiguous-101`, les valeurs possibles sont `0..100` :

```text
width = ceil((100 - 0 + 1) / 100) = 2
```

Les buckets occupés ont pour représentants `0, 2, 4, ..., 98, 100`. Le premier utilise les bornes réelles
`[0,1]` et `floor((0+1)/2) = 0`; le dernier est le bucket tronqué `[100,100]` et garde le représentant
`100`. Les 51 comptes, dans cet ordre, sont :

```text
19,20,14,17,26,14,18,19,23,22,18,24,20,15,19,19,22,23,19,17,22,21,21,24,29,14,
27,22,19,21,16,17,25,17,13,19,19,16,13,32,15,23,17,24,26,17,18,24,20,15,6
```

Leur somme vaut exactement `1000`. Cette référence matérialise ST-33 : l’audit observait 100 buckets côté
Python et 51 centres impairs pouvant atteindre 101 côté TypeScript ; le contrat retient 51 représentants
compris dans leurs bornes réelles.

Pour `histogram-aggregated-discontinuous`, les 101 valeurs distinctes sont `0..99` et `10000` :

```text
width = ceil((10000 - 0 + 1) / 100) = 101
0..99  -> index 0,  bornes [0,100],       x = 50,   compte = 994
10000  -> index 99, bornes [9999,10000],  x = 9999, compte = 6
```

La masse vaut encore `1000`, les deux comptes sont strictement positifs et les représentants sont dans les
bornes réelles. L’audit recensait les centres historiques `50/9951` côté Python et `51/10050` côté
TypeScript ; la référence normative choisit explicitement `50/9999`, sans moteur oracle, et les deux
moteurs appliquent désormais cette géométrie.

Le validateur indépendant ne se contente pas d’autoriser un représentant possible. Pour chaque cas
`weeks_to_items` à une semaine, il rejoue la récurrence scalaire `mca-prng-v1`, forme la distribution brute,
puis reconstruit l’histogramme exact ou agrégé avec la largeur, les bornes inclusives et le plancher
normatifs. Il compare ensuite exactement la séquence des représentants et chaque effectif du corpus. Les
cas continus, discontinus et fortement asymétriques protègent ainsi les deux extrémités, l’absence de
buckets vides, l’ordre, la non-superposition implicite des intervalles et la conservation de masse.

## Probes de validation des entrées

Un cas invalide ne peut pas appartenir à `cases` sans rendre le corpus contraire au schéma. Le contrôle
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

Le point d’entrée délègue la composition complète à
`Scripts/statistical_reference_corpus_validation.py`, qui appelle les modules
`Scripts/statistical_reference_corpus_invariants.py`,
`Scripts/statistical_reference_corpus_pbi_214.py` et
`Scripts/statistical_reference_corpus_pbi_215.py` afin de conserver des contrôles courts et auditables ;
aucun de ces modules ne dépend d’un moteur.

Il valide le métaschème et le corpus, vérifie la complétude des familles de preuve, exécute les
24 probes d’entrées, contrôle les invariants interchamps structurels, la formule et les gardes du Risk Score,
les métriques et labels de fiabilité normalisés, les représentants de buckets à une semaine et l’identité
des résultats spécialisés. Il accepte l’exemple positif et exige le rejet du contre-exemple. Ce rejet doit
désigner `/cases/0/input` avec le mot-clé `additionalProperties`. Des corpus candidats peuvent être fournis
en arguments. Chaque erreur contient le fichier, un JSON Pointer d’instance, le mot-clé en défaut, un message
et le JSON Pointer du schéma, par exemple :

```text
candidate.json:/cases/0/seed: [maximum] 4294967296 is greater than the maximum of 4294967295
```

Le chargeur refuse aussi les propriétés JSON dupliquées avant la validation, car un parseur JSON ordinaire
les écraserait avant que JSON Schema puisse les observer.

## Exécution partagée et rapport

La commande commune est :

```bash
.venv\Scripts\python.exe Scripts/run_statistical_reference_corpus.py
```

Le flux est ordonné et fermé :

1. `Scripts/run_statistical_reference_corpus.py` charge et vérifie le JSON Schema draft 2020-12 ;
2. il valide le corpus candidat, ses invariants interchamps et toutes les familles de preuve figées, y
   compris les seuils et les cas à six et sept observations, avant toute exécution moteur ;
3. seulement si cette étape est verte, `Scripts/statistical_corpus_runner.py` construit chaque
   `SimulationCommand` Python avec la seed du cas et appelle `backend.simulation_service.run_simulation` ;
4. le pont Node valide à nouveau le même fichier avant de charger
   `frontend/src/statisticalCorpusRunner.ts`, qui construit la commande TypeScript, l’adaptateur
   `mca-prng-v1` et appelle `simulateMonteCarloLocal` ;
5. le comparateur confronte `expected_result`, Python et TypeScript sans tolérance ni transformation
   statistique.

Les deux runners convertissent seulement les représentations de langage vers les noms canoniques :
`resultKind` devient `result_kind`, les champs de fiabilité et de complétion deviennent snake_case et les
Value Objects Python deviennent des primitives JSON. Ils ne trient pas les buckets, ne recalculent pas un
score, ne reconstruisent pas une valeur absente et ne normalisent aucun flottant supplémentaire.

Le rapport JSON contient, pour chaque cas, le résultat attendu, les deux résultats canoniques, puis chaque
différence exacte avec son JSON Pointer et son type (`missing_actual`, `unexpected_actual`,
`array_length`, `type_mismatch` ou `value_mismatch`). Les états de niveau supérieur restent distincts :

- `schema_invalid` ou `corpus_invalid` : aucun moteur n’a été appelé ;
- `engine_error` : un moteur ou un cas n’a pas produit de résultat ;
- `normative_divergence` : la sortie d’un moteur diffère de `expected_result` ;
- `engine_divergence` : les deux sorties moteur diffèrent entre elles.

Les artefacts sont
[`reports/statistical-parity-report.json`](../reports/statistical-parity-report.json) et
[`reports/statistical-parity-report.md`](../reports/statistical-parity-report.md). Ils ne portent aucun
horodatage et leur ordre suit celui du corpus, ce qui rend deux exécutions identiques byte-à-byte.
`enforcement = informational` : les divergences laissent la commande à zéro et le contrôle n’est pas dans
le profil `main`. Un schéma/corpus invalide ou une erreur moteur reste une incapacité d’exécution et renvoie
un code non nul.

Le [rapport consolidé de conformité statistique](statistical-consolidated-report.md) consomme ces artefacts
comme preuves versionnées. Il ne rejoue pas le corpus pendant la consolidation et ne modifie ni ses attendus,
ni ses familles normatives, ni ses diagnostics spécialisés.

L’exécution courante observe seize cas intégralement conformes dans les deux moteurs. Les deux références
qui isolaient les constructions historiques convergent désormais :

| Cas | Norme, Python et TypeScript | Anciennes sorties invalidées comme références courantes |
| --- | --- | --- |
| `histogram-aggregated-contiguous-101` | 51 représentants pairs `0..100` | Python : 100 buckets ; TypeScript : centres impairs `1..101` |
| `histogram-aggregated-discontinuous` | `50`, `9999` | Python : `50/9951` ; TypeScript : `51/10050` |

Les seeds, tirages, distributions brutes, percentiles, scores et métriques de fiabilité ne sont pas modifiés
par le runner. Les anciennes sorties agrégées restent des observations historiques et ne peuvent plus être
utilisées comme oracle ou référence normative `1.0`.

## Preuve spécialisée de rejeu exact

La preuve dédiée se régénère localement avec :

```powershell
.venv\Scripts\python.exe Scripts/run_statistical_exact_replay.py
```

Elle produit
[`reports/statistical-exact-replay-evidence.json`](../reports/statistical-exact-replay-evidence.json), sans
horodatage ni dépendance à un résultat moteur antérieur. Le coordinateur réutilise d’abord la validation
indépendante du schéma, du corpus `1.0` et de ses invariants. Le corpus partagé, plus précisément
`expected_result`, reste la seule autorité des résultats attendus : Python ne sert jamais d’oracle à
TypeScript, TypeScript ne sert jamais d’oracle à Python et un batch Python ne sert jamais d’oracle aux
autres.

Les seize cas sont rejoués une fois dans le moteur TypeScript et quatre fois dans le moteur Python. Les
tailles de batch backend et leurs géométries sur les `1000` simulations de chaque cas sont :

| Taille configurée | Géométrie effective | Propriété couverte |
| ---: | --- | --- |
| `125` | `8 × 125` | plusieurs lots, découpage divisible |
| `128` | `7 × 128 + 104` | plusieurs lots, dernier lot non divisible |
| `1000` | `1 × 1000` | lot unique exactement égal à la population |
| `2048` | `1 × 1000` | lot configuré supérieur à la population |

Chaque sortie Python et TypeScript est comparée directement à son `expected_result`, puis chaque sortie
Python est comparée à la sortie TypeScript correspondante. La comparaison récursive exige la présence
exacte des champs, les types primitifs JSON, les longueurs et valeurs, l’ordre des tableaux — notamment des
buckets de distribution —, la présence des percentiles et la forme canonique complète. Elle n’applique
aucune tolérance numérique, aucun arrondi, aucun tri correctif et aucune normalisation silencieuse.

L’indépendance du batching n’est donc pas déduite d’une simple égalité entre deux exécutions : elle est
démontrée, pour chaque cas, lorsque chacune des quatre géométries Python concorde séparément avec l’autorité
versionnée. La preuve courante expose `16` cas indépendants sur `16`, avec `64` exécutions Python,
`16` exécutions TypeScript, `80/80` comparaisons normatives exactes, `64/64` comparaisons interlangages
exactes et `0` diagnostic.

Un diagnostic de divergence contient toujours l’identifiant du cas, le moteur, la taille de batch
applicable, le JSON Pointer divergent, la présence, le type et la valeur attendus, la présence, le type et
la valeur obtenus, puis l’une des classifications `engine_error`, `normative_divergence` ou
`interlanguage_divergence`. L’artefact distingue ainsi une erreur de moteur, une divergence à l’autorité
normative et une divergence entre langages.

`tests/test_statistical_exact_replay.py` couvre la complétude des dimensions, les quatre géométries, les
comparaisons exactes, les diagnostics positifs et négatifs, le refus avant moteur et l’exécution réelle du
corpus dans les deux langages.

Cette preuve porte `proof_kind = exact_replay`,
`distributional_equivalence = not_evaluated` et conserve son statut spécialisé `informational`. Elle démontre une égalité
exacte seed par seed ; elle ne mesure ni ne revendique une équivalence distributionnelle sur plusieurs
seeds. Une divergence fonctionnelle reste visible sans rendre ce contrôle bloquant, tandis qu’un schéma ou
corpus invalide, un plan de batch invalide, une erreur d’infrastructure ou un moteur inexécutable rendent
la commande inexécutable avec un code non nul. Dans le profil `main`, l’adaptateur d’enforcement rend cette
preuve et l’indépendance du batching bloquantes sans changer leur contenu. La consolidation générale et les
décisions de compatibilité restent des responsabilités distinctes. Le
[contrôle de compatibilité](statistical-compatibility.md) vérifie séparément l’empreinte du protocole, le
corpus, les sondes et cette preuve : leur mise à jour coordonnée ne peut donc pas masquer une dérive d’un
moteur, de l’ordre des tirages ou d’une règle statistique.

## Sondes de validation et forme canonique

[`contracts/statistical-validation-probes-v1.0.json`](../contracts/statistical-validation-probes-v1.0.json)
complète les quinze résultats normatifs alors présents sans les changer. Ses 22 sondes sont soumises aux deux
fabriques normalisées avant tout appel moteur :

- les sondes positives couvrent les bornes, les deux modes, les zéros inclus et les six observations
  restant utilisables après exclusion ;
- les sondes négatives couvrent types non entiers, booléens, décimaux, négatifs, cardinalités brutes et
  utiles, champs obligatoires ou inconnus, paramètre actif/inactif et seed hors `uint32` ;
- les valeurs non finies, qui ne sont pas représentables dans un JSON strict, sont couvertes directement
  dans les suites Python et TypeScript.

Une entrée normalisée est fermée et entièrement explicite : `samples`, `include_zero_weeks`, `n_sims`,
`mode` et le seul paramètre actif sont obligatoires. Les valeurs par défaut appartiennent aux frontières de
transport, qui résolvent de manière commune `false` et `20000` avant de créer les objets métier. Les DTO,
l’API, MongoDB et `localStorage` restent constitués de primitives.

La réponse canonique est elle aussi fermée. Elle exige le type de résultat, les percentiles présents, la
distribution, le nombre d’échantillons, la fiabilité et la seed. Le Risk Score et la complétion ne sont
émis que lorsqu’ils existent ; leur absence ne peut jamais devenir `0`, `null`, `NaN`, une chaîne vide ou
une autre sentinelle. La complétion n’est autorisée que pour `backlog_to_weeks`.

Le rapport expose `validation_alignment`: les 22 sondes concordent entre Python et TypeScript, sans
divergence ni erreur. Les seize cas statistiques concordent aussi exactement avec la norme et entre les
deux moteurs. Ces sondes ne modifient aucune formule statistique ; leur artefact spécialisé demeure
informatif, tandis que leur validation est un prérequis bloquant de `main`.

## Preuves des censures, percentiles et Risk Score

Les six cas discriminants restent inchangés. Ils sont regroupés par l’identifiant technique
`PBI_214_CASE_IDS`, avec un contrôle de périmètre dédié :

- `items-zero-weeks-excluded` démontre les quantiles de survie P50/P70/P90 `3/2/1` et le score `0.6667` ;
- `weeks-zero-weeks-included-no-censorship` démontre les rangs backlog `2/3/4` dans la population totale ;
- `weeks-exact-horizon-completion` distingue trois percentiles `521` d’une censure ;
- `weeks-partial-censorship` conserve seulement P50 `518` et P70 `521`, sans P90 ni score ;
- `weeks-total-censorship` ne contient ni durée terminée, ni percentile, ni score ;
- `risk-p50-zero-absent` conserve les trois percentiles nuls mais omet le score car `P50 <= 0`.

Dans les deux moteurs, `backlog_to_weeks` ne matérialise plus les censures par une durée sentinelle.
La structure interne conserve seulement les semaines des simulations terminées et la taille de population
`n_sims`. Pour chaque `p` dans `50, 70, 90`, le rang est `ceil(p × n_sims / 100)` ; si le nombre de fins
est inférieur à ce rang, le percentile est omis. `weeks_to_items` trie la population complète et lit
l’indice `floor((100 - p) × (n_sims - 1) / 100)`.

Les Value Objects `SimulationPercentiles` Python et TypeScript portent l’autorité unique du Risk Score.
Ils appliquent la formule du mode avec des entiers, puis l’arrondi rationnel `round half up` à quatre
décimales. Le backend produit cette valeur ; les mappers exigent son égalité exacte lorsqu’elle est
calculable ; l’interface et les rapports la consomment sans recalcul. Les historiques existants peuvent
omettre le champ, mais cette absence est conservée.

Les hooks et mappers n’utilisent plus l’histogramme comme source secondaire de percentiles. Une distribution
riche ne peut donc pas recréer P50, P70 ou P90 absent. Le rapport de parité confirme les six cas dans
les deux langages. Son état global est `match` et l’enforcement reste informatif.

## Preuves des métriques et labels de fiabilité

`PBI_215_CASE_IDS` regroupe les seuils exacts, les quatre labels, les preuves existantes à
six observations et `reliability-seven-observations-degraded`. Le contrôle de périmètre fige les métriques
normalisées, les labels et le rejeu indépendant du nouveau cas. Le validateur autonome recalcule toujours
moyenne, variance de population, quartiles et pente depuis les samples ; il ne lit jamais la sortie d’un
moteur comme résultat attendu.

Dans chaque langage, le calcul complet appartient désormais au domaine de fiabilité. Python utilise
`calculate_throughput_reliability` dans `backend/throughput_reliability.py`; TypeScript utilise
`computeThroughputReliability` dans `domain/throughputReliability.ts`. Le calculateur produit les métriques
brutes et le Value Object porte leur normalisation et le label. Les deux suivent exactement :

1. moyenne arithmétique et variance divisée par `n` ;
2. `Q25`, médiane et `Q75` avec `h = (n - 1) × q` et interpolation linéaire ;
3. pente des moindres carrés avec `x[i] = i`, sans `polyfit` ;
4. ratios bruts, puis `round half up` à quatre décimales ;
5. catégories dans l’ordre `non fiable`, `fragile`, `incertain`, `fiable` ;
6. dégradation d’un résultat autrement fiable à `incertain` lorsque `n` vaut `6` ou `7`.

`backend/mc_core.py` et `frontend/src/utils/simulation.ts` ne portent plus de calcul concurrent. Les
frontières sérialisées continuent à ne transporter que les cinq primitives de fiabilité existantes. Les
histogrammes sont construits par leurs autorités de domaine dédiées sans modifier ces métriques ni ces
frontières ; le rapport demeure informatif.

## Réutilisation par le protocole distributionnel

Le [protocole de parité distributionnelle](statistical-distribution-protocol.md) référence cinq cas de ce
corpus uniquement comme autorités d’entrées normalisées. Il remplace la seed et `n_sims` par ceux de son
plan versionné, et n’inclut jamais `expected_result` dans un plan moteur. Ses cohorts Python et TypeScript
sont disjointes : cette preuve compare des lois, alors que
`reports/statistical-exact-replay-evidence.json` conserve l’autorité distincte de l’égalité exacte pour une
même seed.

Le validateur distributionnel appelle d’abord le validateur indépendant du corpus. Un corpus invalide ou
une version différente empêche donc toute exécution, mais les résultats exacts du corpus ne peuvent pas
transformer la décision multi-seeds en rejeu.

## Évolution

La version `1.0` est immuable. Toute évolution incompatible des entrées, de la seed, des résultats ou du
niveau de preuve requiert une nouvelle version normative et une décision de compatibilité conforme à
`STAT-PAR-048`. Ce versionnement du corpus ne modifie aucun DTO, payload API, document MongoDB ni objet
`localStorage`.

L’autorité de compatibilité distingue le schéma, les résultats attendus et les sondes. Une nouvelle version
doit référencer les preuves exactes et distributionnelles régénérées, conserver la lignée des empreintes et
déclarer le sort des résultats seedés, historiques, caches, exports et artefacts de rejeu. Modifier seulement
le corpus, son numéro de version ou son empreinte ne suffit pas à accepter une évolution.
