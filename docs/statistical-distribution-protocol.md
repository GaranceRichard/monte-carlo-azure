# Protocole de parité distributionnelle

## Objet, portée et séparation des preuves

Le protocole `mca-statistical-distributional-parity` version `1.0` évalue symétriquement les lois de sortie
des moteurs Python et TypeScript sur des cohortes de seeds distinctes. Il complète la preuve de rejeu exact :
il ne réemploie jamais `expected_result`, ne couple pas les mêmes seeds et ne prend aucun moteur comme
oracle. Le corpus `mca-statistical-reference-corpus` `1.0` reste uniquement l’autorité des entrées
normalisées et `STD-STAT-001` `1.0` celle des règles métier.

Cette preuve n’est pas un backtesting. Elle n’utilise ni tenant Azure DevOps, ni historique réel, ni état
passé de projet et ne mesure donc ni calibration temporelle, ni représentativité de données réelles, ni
qualité prédictive. Ces questions restent séparées dans la Feature 9.

## Audit préalable et risques traités

L’audit historique comparait quatre seeds générales et une expérience ciblée sur les seeds `0..999` près
du rang de censure P90. Cette dernière exposait une forte variabilité de présence de P90, mais ne démontrait
pas de biais interlangage. Depuis, le PRNG, l’ordre de tirage, la censure, les percentiles, le Risk Score,
la fiabilité et les histogrammes ont été alignés et le rejeu exact les couvre déjà.

Le protocole évite cinq confusions :

- les cohorts sont disjointes, afin qu’une égalité seed à seed ne puisse tenir lieu de preuve
  distributionnelle ;
- la censure est un état analytique distinct placé après l’horizon dans la CDF, jamais une durée fabriquée
  de `522` semaines dans une sortie moteur ;
- la présence de P50, P70, P90 et du Risk Score est comparée séparément de leurs valeurs conditionnelles ;
- les métriques et labels de fiabilité, déterministes par entrée, sont contrôlés exactement mais ne sont pas
  présentés comme une preuve aléatoire supplémentaire ;
- une région de confiance trop large produit `inconclusive`, jamais `match`.

Les faux positifs peuvent venir de la multiplicité des métriques ; la faible puissance, des petites
cohortes ; la redondance, d’une comparaison exacte des mêmes seeds ; et les erreurs d’interprétation, d’un
percentile absent conditionnellement à la censure. Ces risques sont mesurés ou rendus explicites ci-dessous.

## Autorités machine

Les objets de protocole et de seeds sont fermés par JSON Schema draft 2020-12 :

- `contracts/statistical-distribution-protocol-v1.0.json` et son schéma définissent scénarios, tailles,
  métriques, méthodes, seuils, règle globale et calibration ;
- `contracts/statistical-distribution-seeds-v1.0.json` et son schéma définissent la construction et les
  empreintes de la population ;
- `contracts/statistical-distribution-evidence-v1.0.schema.json` ferme la preuve ciblée ;
- `contracts/statistical-distribution-calibration-v1.0.schema.json` ferme la preuve de calibration ;
- `Scripts/validate_statistical_distribution_protocol.py` régénère la population, vérifie ses empreintes,
  les versions, les scénarios du corpus et la résolution minimale des permutations sans importer un moteur ;
- `Scripts/validate_statistical_distribution_calibration.py` recalcule toute la calibration et exige une
  égalité exacte avec l’artefact versionné ;
- `Scripts/validate_statistical_distribution_evidence.py` contrôle schéma, comptes, cohérence des verdicts
  et empreinte de la preuve.

Une version de corpus, standard, PRNG ou population différente produit `version_incompatibility`. Une
forme, règle, empreinte ou configuration invalide produit `protocol_error`.

## Population de seeds

La population version `1.0` contient 256 seeds `uint32`. Pour le compteur décimal `i` à partir de zéro, la
règle calcule SHA-256 sur l’UTF-8
`mca-distributional-parity-seeds-v1.0:<i>`, lit les quatre premiers octets en big-endian et rejette toute
collision avant de continuer. Les 128 premières valeurs forment `cohort-a`, les 128 suivantes `cohort-b`.
Python reçoit `cohort-a` et TypeScript `cohort-b`; les cohorts ne se chevauchent pas et
`same_seed_pairing = false`.

Les empreintes SHA-256 des deux partitions sont respectivement
`b1e830b946f36f39a0411574cc34df9593cf00fa8272a22704de95af96b48c6f` et
`69430b9209e1c4c759ea22590ec63e8a05c147841bf7592fac15320f55daa1ba`. L’empreinte de la population
complète est `889e757eab13c3766225989e5df3660affccd90dddc91d9314e7b0e3e4a621e9`.

## Scénarios et tailles

| Scénario | Cas source | Mode | Seeds par moteur | Simulations par seed | Vue principale |
| --- | --- | --- | ---: | ---: | --- |
| `items-discrete-exact` | `items-zero-weeks-excluded` | capacité | 64 | 4 000 | CDF discrète exacte |
| `items-histogram-aggregated` | `histogram-aggregated-discontinuous` | capacité | 128 | 4 000 | CDF de l’histogramme restitué |
| `weeks-no-censorship` | `weeks-zero-weeks-included-no-censorship` | délai | 64 | 2 000 | CDF discrète exacte |
| `weeks-partial-censorship` | `weeks-partial-censorship` | délai | 64 | 1 000 | CDF avec état censuré |
| `weeks-total-censorship` | `weeks-total-censorship` | délai | 8 | 1 000 | état structurel de censure totale |

La censure totale est une garde structurelle : elle prouve la conservation de l’absence des percentiles et
du score, mais n’est pas utilisée pour prétendre à une puissance distributionnelle avec huit seeds. Les
tailles inférentielles minimales `32×2000` ou `64×1000` viennent de la calibration. Le cas d’histogramme
agrégé utilise 128 seeds car la calibration conditionnelle DKW montre que 32 observations ne permettent
pas une conclusion avec la marge déclarée.

## Métriques et inférence

Chaque scénario compare la CDF discrète restituée. Les scénarios de délai comparent en plus les taux de
complétion et de censure ; chaque simulation censurée contribue à l’état analytique `horizon + 1` uniquement
pour calculer la CDF de temps d’atteinte. Pour P50, P70, P90 et Risk Score, le protocole compare d’abord le
taux de présence sur les seeds, puis la CDF des valeurs seulement lorsque chaque moteur fournit au moins
huit observations. Une absence bilatérale est une concordance explicite de l’état, pas un échantillon vide
déclaré implicitement vert. Une présence unilatérale insuffisante reste `inconclusive`.

Les distributions sont discrètes : le test de divergence permute donc les blocs de seeds complets et
recalcule la statistique de Kolmogorov–Smirnov ou l’écart de taux. Il ne recourt pas aux tables KS continues.
La valeur p utilise la correction `(+1)/(B+1)` et `B = 2047`; avec 42 comparaisons inférentielles, sa
résolution `1/2048` est plus fine que le plus petit seuil initial de Holm `0,05/42`.

L’équivalence n’est jamais déduite d’une valeur p non significative :

- CDF groupées : borne supérieure DKW bilatérale par union, marge `0,025` ;
- taux groupés de complétion/censure : intervalle de différence Newcombe–Wilson, marge `0,02` ;
- taux de présence par cohort : intervalle Newcombe–Wilson, marge `0,45` ;
- CDF conditionnelles sur les seeds : borne DKW, marge `0,60` ;
- fiabilité et états structuraux : égalité exacte, marge nulle.

Les marges larges des métriques au niveau seed rendent la limite de puissance visible : elles détectent des
écarts décisionnels massifs comme « P90/Risk Score présent 30 % contre 100 % », pas des effets fins. Les
CDF groupées et taux de censure disposent d’une résolution beaucoup plus stricte. Une évolution nécessitant
des marges plus étroites doit augmenter les cohorts et versionner le protocole.

Le risque familial est `0,05`. Les régions de confiance utilisent Bonferroni simultané ; les valeurs p de
divergence utilisent Holm–Bonferroni. Une métrique vaut :

- `match` si toute sa région de confiance est dans la marge d’équivalence ;
- `divergence` si sa valeur p ajustée est au plus `0,05` et son effet dépasse la marge ;
- `inconclusive` dans la zone grise ou faute d’observations conditionnelles ;
- `invalid` si l’expérience n’est pas statistiquement interprétable ou techniquement valide.

Un scénario est `match` si toutes ses métriques requises le sont, `divergence` si au moins une diverge,
sinon `inconclusive`. La même règle agrège les scénarios.

## Autorités statistiques

Le choix des méthodes repose sur :

- Dvoretzky, Kiefer et Wolfowitz (1956), *Asymptotic minimax character of the sample distribution function
  and of the classical multinomial estimator*, puis la constante optimale de Massart (1990), pour les
  bandes non paramétriques valides aussi sur lois discrètes ;
- Wilson (1927), *Probable inference, the law of succession, and statistical inference*, et Newcombe
  (1998), *Interval estimation for the difference between independent proportions*, pour les taux ;
- Holm (1979), *A simple sequentially rejective multiple test procedure*, pour le contrôle familial ;
- Phipson et Smyth (2010), *Permutation P-values should never be zero*, pour la correction des permutations ;
- Cohen (1988), *Statistical Power Analysis for the Behavioral Sciences*, pour la cible conventionnelle de
  puissance `0,80`, contrôlée ici plutôt que supposée.

## Calibration contrôlée

`Scripts/calibrate_statistical_distribution.py` utilise un flux PCG64 séparé, seed `218002`, sur 200
répétitions. Il évalue les cohorts `16`, `32`, `64`, `128` et `1 000`, `2 000`, `4 000` simulations sous
lois nulles Bernoulli `0,10`, Bernoulli `0,50` et discrète à trois masses. Les alternatives contrôlées sont :

- taux de censure `0,10` contre `0,15`, écart de cinq points pouvant changer l’identifiabilité de P90 ;
- présence `0,30` contre `1,00`, écart de l’ordre de la divergence historique du Risk Score absent ;
- déplacement de masse CDF de `0,10` ;
- déplacement conditionnel CDF de `0,80` pour la métrique de faible effectif.

L’artefact courant observe zéro famille faussement divergente sur 200. La borne d’acceptation n’est pas un
nombre choisi après coup : c’est le quantile binomial à 99 % sous `p = 0,05`, soit 18 familles. Les quatre
alternatives atteignent une puissance observée de `1,00` au design de production. Sous même loi, la grille
montre `0,00` de conclusion d’équivalence CDF pour `16×1000`, contre au moins `0,99` à `64×1000`; elle rend
ainsi explicitement visible l’effet des tailles au lieu de transformer une faible puissance en succès.

La calibration est une validation contrôlée des critères, non une preuve théorique universelle ni une
qualification indépendante de PCG64. Elle utilise un test de score comme proxy rapide de sensibilité pour
les alternatives binaires ; le runner réel conserve les permutations par blocs prévues par le protocole.

## Erreurs, artefacts et commandes

La preuve `reports/statistical-distribution-evidence.json` expose versions, cohorts, tailles, effets,
intervalles, marges, valeurs p brutes et ajustées, verdicts, diagnostics et empreinte SHA-256 canonique.
`reports/statistical-distribution-calibration.json` expose faux positifs, puissance, grille de tailles et sa
propre empreinte. Aucun timestamp ni ordre variable n’entre dans ces fichiers ; deux exécutions identiques
doivent être byte à byte égales.

Les classifications sont séparées : `distributional_divergence`, `statistically_inconclusive`,
`version_incompatibility`, `engine_error`, `protocol_error` et `infrastructure_error`. Seules les deux
premières appartiennent à une exécution statistiquement valide. Le contrôle reste informatif pour
`match`, `divergence` ou `inconclusive`, mais retourne un code non nul pour `invalid`.

```powershell
.venv\Scripts\python.exe Scripts\validate_statistical_reference_corpus.py
.venv\Scripts\python.exe Scripts\validate_statistical_distribution_protocol.py
.venv\Scripts\python.exe Scripts\calibrate_statistical_distribution.py
.venv\Scripts\python.exe Scripts\validate_statistical_distribution_calibration.py
.venv\Scripts\python.exe Scripts\run_statistical_distribution.py
.venv\Scripts\python.exe Scripts\validate_statistical_distribution_evidence.py
```

Le protocole ne consolide pas les autres preuves, ne décide aucune compatibilité future et n’ajoute aucun
blocage au profil `main`. Le [rapport consolidé](statistical-consolidated-report.md) le consomme comme une
source spécialisée sans modifier ses scénarios, métriques, calibrations, seuils ni limites.

Le [contrôle de compatibilité](statistical-compatibility.md) surveille séparément le protocole, la population
de seeds, la calibration et la preuve courante. Une évolution acceptée doit maintenir des versions cohérentes,
renouveler les artefacts requis et décider du traitement des rapports et preuves antérieurs. Le contrôle
distributionnel demeure une preuve spécialisée : ni sa régénération ni un verdict `match` ne suffisent à
accepter une dérive normative.
