# Standard de parité et de reproductibilité statistiques

**Référence :** STD-STAT-001
**Version :** 1.0
**Statut :** Standard projet
**Titre :** Standard de parité et de reproductibilité statistiques
**Périmètre :** moteur Monte Carlo Python, moteur local TypeScript, contrat statistique commun et restitution des résultats normatifs

---

## 1. Objet et autorité

Le présent standard tranche les décisions ouvertes par l’[audit historique de parité
statistique](../statistical-parity-audit.md). Il définit la cible contractuelle commune ; son adoption ne
constitue pas à elle seule une preuve de conformité des moteurs.

Les termes normatifs ont le sens suivant :

- **DOIT** : exigence obligatoire ;
- **NE DOIT PAS** : interdiction ;
- **DEVRAIT** : pratique attendue, sauf justification de compatibilité documentée ;
- **PEUT** : possibilité autorisée, sans caractère obligatoire.

Les résultats statistiques normatifs sont les valeurs définies par ce standard avant toute transformation
de présentation, de persistance ou de diagnostic métier.

## 2. Niveaux de parité et cible commune

### STAT-PAR-001 — Niveaux de parité

Le contrat commun **DOIT** distinguer quatre niveaux :

1. la **parité algorithmique**, où les règles, conditions d'arrêt, formules et conventions sont identiques ;
2. la **parité déterministe**, où une entrée déterministe produit exactement les mêmes résultats normatifs ;
3. la **parité de rejeu**, où les mêmes entrées normalisées, la même version de contrat et la même seed
   produisent exactement les mêmes résultats normatifs en Python et TypeScript ;
4. la **parité distributionnelle**, qui compare plusieurs seeds comme validation complémentaire.

### STAT-PAR-002 — Cible normative du cœur commun

À entrée normalisée, version de contrat et seed identiques, Python et TypeScript **DOIVENT** produire
exactement les mêmes résultats statistiques normatifs.

### STAT-PAR-003 — Aléatoire contractuel

La parité de rejeu **DOIT** reposer sur le même algorithme pseudo-aléatoire contractuel, la même consommation
du flux aléatoire et le même ordre logique de tirage dans les deux moteurs.

### STAT-PAR-004 — Indépendance du batching et conventions communes

Les résultats normatifs **DOIVENT** être indépendants du découpage en lots. Un changement de batching
**NE DOIT PAS** modifier la séquence logique de tirage, les règles de censure ni la restitution.

### STAT-PAR-005 — Rôle de la parité distributionnelle

La parité distributionnelle **DOIT** compléter la parité de rejeu sur plusieurs seeds et **NE DOIT PAS**
la remplacer.

### STAT-PAR-006 — Seed automatique

La seed automatique **PEUT** être générée différemment selon l'environnement. La seed résolue **DOIT** être
renvoyée sans altération et **DOIT** permettre le rejeu.

## 3. Domaine et résolution de la seed

### STAT-PAR-007 — Domaine numérique

La seed normative **DOIT** être un entier non signé sur 32 bits appartenant à l'intervalle inclusif
`0..4294967295`.

### STAT-PAR-008 — Entrée explicite du moteur

Le moteur commun **DOIT** recevoir une seed explicite avant tout tirage.

### STAT-PAR-009 — Absence de conversion silencieuse

Une seed **NE DOIT PAS** être tronquée, ramenée silencieusement modulo `2^32` ni renvoyée sous une valeur
différente de celle qui a été validée.

### STAT-PAR-010 — Omission aux frontières

La seed **PEUT** être absente à une frontière API ou UI uniquement si cette frontière génère et valide une
seed conforme avant l'appel du moteur. La frontière **DOIT** transmettre ensuite la seed résolue au moteur
et la restitution **DOIT** exposer cette même valeur.

## 4. Contrat des entrées

### STAT-PAR-011 — Sémantique du throughput

Chaque valeur de `throughput_samples` **DOIT** représenter un nombre d'items terminés pendant une semaine
complète.

### STAT-PAR-012 — Validation stricte des samples

Les `throughput_samples` **DOIVENT** être des entiers finis supérieurs ou égaux à zéro. Ils **NE DOIVENT PAS**
accepter les chaînes numériques, les décimaux avec troncature ou arrondi implicite, les valeurs négatives ou
les valeurs non finies. Une valeur invalide **NE DOIT PAS** être filtrée silencieusement.

### STAT-PAR-013 — Traitement des semaines à zéro

La validité de chaque sample **DOIT** être établie avant tout traitement de `include_zero_weeks`. Les valeurs
valides **PEUVENT** ensuite être conservées ou exclues conformément à ce paramètre.

### STAT-PAR-014 — Bornes contractuelles

Le contrat **DOIT** conserver les bornes inclusives suivantes : historique brut de `6..521` valeurs,
historique utilisable après traitement des zéros d'au moins `6` valeurs, `n_sims` dans `1000..200000`,
`backlog_size` dans `1..1000000` et `target_weeks` dans `1..521`.

### STAT-PAR-015 — Champs supplémentaires

Une requête normative **DOIT** refuser tout champ supplémentaire au contrat de sa version.

### STAT-PAR-016 — Paramètres actifs et inactifs

`backlog_size` **DOIT** être présent en mode `backlog_to_weeks` et `target_weeks` **DOIT** être présent en
mode `weeks_to_items`. Le paramètre de l'autre mode **DEVRAIT** être absent ; s'il est temporairement toléré
pour compatibilité, il **NE DOIT PAS** influencer le calcul.

### STAT-PAR-017 — Résolution des valeurs par défaut

Des valeurs par défaut **PEUVENT** exister aux frontières API ou UI. Le moteur commun **DOIT** recevoir un
contrat entièrement résolu et explicite, sans dépendre d'un défaut propre à son environnement.

## 5. Modes de simulation

### STAT-PAR-018 — Mode `backlog_to_weeks`

Pour chaque simulation, le moteur **DOIT** tirer avec remplacement un throughput par semaine, cumuler les
tirages jusqu'à atteindre ou dépasser le backlog et compter les semaines à partir de `1`. Il **DOIT**
s'arrêter au plus tard à la semaine `521`. Une simulation qui atteint le backlog pendant la semaine `521`
**DOIT** être terminée ; une simulation qui ne l'a pas atteint à la fin de cette semaine **DOIT** être
censurée.

### STAT-PAR-019 — Mode `weeks_to_items`

Pour chaque simulation, le moteur **DOIT** effectuer exactement `target_weeks` tirages avec remplacement,
additionner les valeurs tirées et retourner un nombre entier d'items.

## 6. Censure et percentiles

### STAT-PAR-020 — Représentation des censures

En mode `backlog_to_weeks`, une simulation censurée **NE DOIT PAS** être représentée comme une durée de
`521` semaines et **DOIT** être exclue de la distribution brute des durées terminées.

### STAT-PAR-021 — Rang sur la population totale

Pour un percentile `Pp` de `backlog_to_weeks`, le rang **DOIT** être calculé sur la population totale des
simulations selon `rank = ceil((p / 100) × n_sims)`. Lorsque ce rang est identifiable, la valeur **DOIT**
être la durée située à cette position, comptée à partir de `1`, dans les durées terminées triées par ordre
croissant.

### STAT-PAR-022 — Identifiabilité d'un percentile censuré

Un percentile de `backlog_to_weeks` **DOIT** exister uniquement si le nombre de simulations terminées atteint
son rang. Un percentile non identifiable **DOIT** être absent et **NE DOIT PAS** être remplacé par `0`, `521`,
une valeur approchée ou la dernière valeur disponible.

### STAT-PAR-023 — Quantiles de survie pour les items

Les percentiles de `weeks_to_items` **DOIVENT** être des quantiles de survie discrets conservateurs : `Pp`
**DOIT** correspondre au quantile discret inférieur de niveau `(100 - p) / 100` dans la distribution brute.

### STAT-PAR-024 — Ensemble public des percentiles

Le contrat public normatif **DOIT** exposer uniquement `P50`, `P70` et `P90`. Tout autre percentile **DOIT**
rester hors du contrat public jusqu'à une extension versionnée.

### STAT-PAR-025 — Invariants d'ordre

Les percentiles présents **DOIVENT** respecter `P50 <= P70 <= P90` pour `backlog_to_weeks` et
`P50 >= P70 >= P90` pour `weeks_to_items`. Une valeur absente **NE DOIT PAS** être fabriquée pour satisfaire
artificiellement ces invariants.

## 7. Risk Score

### STAT-PAR-026 — Conditions de calcul

Le Risk Score **DOIT** être calculé uniquement si `P50` et `P90` sont présents et si `P50` est strictement
positif. Dans tout autre cas, il **DOIT** être absent, **NE DOIT PAS** valoir `0` et **NE DOIT PAS** être
présenté par l'UI ou les rapports comme un risque faible.

### STAT-PAR-027 — Formules

Le Risk Score **DOIT** utiliser `max(0, (P90 - P50) / P50)` pour `backlog_to_weeks` et
`max(0, (P50 - P90) / P50)` pour `weeks_to_items`.

### STAT-PAR-028 — Précision et autorité

Le Risk Score **DOIT** être calculé à partir des percentiles entiers normatifs, arrondi à quatre décimales
selon la convention décimale `round half up`, puis transmis comme valeur d'autorité aux consommateurs.

### STAT-PAR-029 — Consommation du score

Lorsque le Risk Score normatif est disponible, l'UI et les PDF **NE DOIVENT PAS** recalculer une valeur
différente. La légende **PEUT** rester une responsabilité frontend, mais elle **DOIT** utiliser le score
normatif reçu.

## 8. Fiabilité du throughput

### STAT-PAR-030 — Métriques et formules communes

La fiabilité **DOIT** utiliser la moyenne arithmétique, la variance de population, l'écart-type de population,
`Q25`, la médiane et `Q75` avec interpolation linéaire, le coefficient de variation, le ratio interquartile,
la pente de régression linéaire par moindres carrés et la pente normalisée par la moyenne. Pour des valeurs
triées `y[0..n-1]`, un quantile de niveau `q` **DOIT** utiliser `h = (n - 1) × q`, `j = floor(h)` et
`Qq = y[j] + (h - j) × (y[min(j + 1, n - 1)] - y[j])`. Le coefficient de variation **DOIT** être
`écart-type / moyenne` lorsque la moyenne est positive, le ratio interquartile **DOIT** être
`(Q75 - Q25) / médiane` lorsque la médiane est positive, et les ratios **DOIVENT** valoir `0` lorsque leur
dénominateur n'est pas positif ; la priorité de classement de `STAT-PAR-033` reste applicable.

### STAT-PAR-031 — Régression déterministe

Avec `x[i] = i`, la pente **DOIT** être calculée par
`sum((x[i] - moyenne(x)) × (y[i] - moyenne(y))) / sum((x[i] - moyenne(x))²)` et la pente normalisée
**DOIT** être `pente / moyenne(y)` lorsque la moyenne est positive, sinon `0`. Le contrat **NE DOIT PAS**
dépendre d'une implémentation spécifique telle que `numpy.polyfit`.

### STAT-PAR-032 — Normalisation avant classement

Les métriques utilisées pour la catégorisation **DOIVENT** être normalisées à quatre décimales selon
`round half up` avant toute comparaison aux seuils. La valeur exposée et la valeur utilisée pour décider du
label **DOIVENT** être identiques.

### STAT-PAR-033 — Ordre de catégorisation

Le label **DOIT** être choisi dans l'ordre suivant, sans réévaluer une catégorie de priorité inférieure :

1. `non fiable` si le nombre d'observations est inférieur à `6`, si la moyenne est inférieure ou égale à
   `0`, si `cv >= 1.5` ou si `slope_norm <= -0.15` ;
2. sinon `fragile` si `cv >= 1`, `iqr_ratio >= 1` ou `abs(slope_norm) >= 0.1` ;
3. sinon `incertain` si `cv >= 0.5`, `iqr_ratio >= 0.5` ou `abs(slope_norm) >= 0.05` ;
4. sinon `fiable`.

### STAT-PAR-034 — Historique court

Un résultat initialement `fiable` avec `6` ou `7` observations **DOIT** être dégradé en `incertain`.

### STAT-PAR-035 — Entrées de fiabilité invalides

Les valeurs non finies ou invalides **DOIVENT** être rejetées avant le calcul de fiabilité. Elles
**NE DOIVENT PAS** être filtrées silencieusement dans un moteur et propagées dans l'autre.

## 9. Histogrammes

### STAT-PAR-036 — Source statistique d'autorité

La distribution brute **DOIT** rester la source statistique d'autorité. L'histogramme **DOIT** rester une
représentation compacte et **NE DOIT PAS** servir à recalculer les percentiles normatifs.

### STAT-PAR-037 — Histogramme exact

Lorsque le nombre de valeurs distinctes est inférieur ou égal à `100`, l'histogramme **DOIT** contenir un
bucket exact par valeur et les buckets **DOIVENT** être triés par `x` croissant.

### STAT-PAR-038 — Histogramme agrégé

Lorsque le nombre de valeurs distinctes dépasse `100`, le moteur **DOIT** appliquer exactement :

```text
width = ceil((max - min + 1) / 100)
index = floor((value - min) / width)
left  = min + index × width
right = min(max, left + width - 1)
x     = floor((left + right) / 2)
```

Chaque valeur **DOIT** contribuer au compte du bucket désigné par `index`.

### STAT-PAR-039 — Invariants des buckets

L'histogramme **DOIT** contenir au plus `100` buckets, aucun bucket vide, des comptes entiers dont la somme
conserve exactement la masse de la distribution, un ordre `x` strictement croissant et un représentant `x`
compris dans les bornes réelles de son bucket.

## 10. Forme de réponse et valeurs d'autorité

### STAT-PAR-040 — Résultats communs

La réponse normative **DOIT** exposer `result_kind`, `samples_count`, `seed`, `result_percentiles`,
`result_distribution` et `throughput_reliability`. Elle **DOIT** exposer `risk_score` seulement s'il est
calculable et `completion_summary` seulement pour `backlog_to_weeks`. `result_kind` **DOIT** valoir `weeks`
pour `backlog_to_weeks` et `items` pour `weeks_to_items`. `result_distribution` **DOIT** contenir
l'histogramme défini à la section 9, tandis que la distribution brute reste l'autorité interne.
`samples_count` **DOIT** être le nombre de samples valides effectivement utilisés après application de
`include_zero_weeks`.

### STAT-PAR-041 — Omission des valeurs absentes

Toute valeur absente **DOIT** être omise du contrat sérialisé. Elle **NE DOIT PAS** être remplacée par
`null`, `0` ou une valeur sentinelle sans règle explicite du présent standard.

### STAT-PAR-042 — Résumé de complétion

`completion_summary` **DOIT** contenir `completed_count`, `censored_count`, `censored_rate` arrondi à quatre
décimales selon `round half up`, et `horizon_weeks`. Les comptes **DOIVENT** être entiers, leur somme
**DOIT** être égale à `n_sims`, `censored_rate` **DOIT** être égal à `censored_count / n_sims` avant arrondi
et `horizon_weeks` **DOIT** valoir `521` pour la version `1.0`.

### STAT-PAR-043 — Autorité des résultats calculés

Les résultats normatifs calculés par le moteur **DOIVENT** être la source d'autorité. La persistance,
l'historique, l'UI et les rapports **NE DOIVENT PAS** en modifier le sens.

## 11. Frontière de la parité

### STAT-PAR-044 — Responsabilités incluses

La parité du cœur **DOIT** inclure la validation statistique normalisée, le PRNG contractuel, les simulations,
la censure, les percentiles, le Risk Score, la fiabilité, les histogrammes et la forme statistique commune
de réponse.

### STAT-PAR-045 — Responsabilités frontend-only

La collecte Azure DevOps, la constitution des semaines complètes, le Cycle Time, les scénarios portefeuille,
l'intersection des semaines corrélées, les diagnostics métier, les courbes de présentation, le lissage,
l'UI et les PDF **DOIVENT** rester hors du cœur commun. Ces responsabilités **NE DOIVENT PAS** être
réimplémentées en Python uniquement pour créer une parité artificielle.

### STAT-PAR-046 — Consommation à la frontière

Les responsabilités frontend-only **DOIVENT** consommer les résultats normatifs sans les altérer. Le Cycle
Time **DOIT** rester explicitement hors du contrat de parité Monte Carlo.

### Contrôle opérationnel du standard

Le profil `main` applique ce standard sans en étendre la portée. Il valide les autorités et exécute les
preuves déterministe, exacte, de batching, distributionnelle et de compatibilité avant de produire puis
valider leur rapport consolidé. `match` n’est accepté qu’avec des sources présentes, cohérentes, actuelles et
liées au même snapshot. La politique d’exécution et ses statuts sont définis dans
[`statistical-main-enforcement.md`](../statistical-main-enforcement.md) ; elle ne modifie aucune règle
`STAT-PAR`, aucun seuil, corpus, scénario ou protocole.

## 12. Versionnement et compatibilité

### Matérialisation du corpus version `1.0`

La frontière sérialisée de rejeu est matérialisée dans
[`contracts/statistical-reference-corpus-v1.0.schema.json`](../../contracts/statistical-reference-corpus-v1.0.schema.json).
Ce JSON Schema draft 2020-12 associe explicitement chaque entrée normalisée à sa seed uint32, au contrat
`mca-prng-v1`, à son résultat normatif attendu et à l’un des quatre niveaux de parité de `STAT-PAR-001`.
Le schéma est fermé et indépendant des DTO et des moteurs.

Cette frontière est instanciée dans
[`contracts/statistical-reference-corpus-v1.0.json`](../../contracts/statistical-reference-corpus-v1.0.json).
Ses cinq cas matérialisent `STAT-PAR-012` à `STAT-PAR-025` pour les entrées, zéros, modes, horizon,
censures et percentiles. Les résultats attendus sont dérivés du présent standard et de `mca-prng-v1` sans
utiliser un moteur comme oracle.

Le corpus contient aussi dix cas discriminants pour `STAT-PAR-026` à `STAT-PAR-039`. Ils figent le calcul et les
gardes d’absence du Risk Score, tous les seuils de `cv`, `iqr_ratio` et `slope_norm` après arrondi normatif,
les quatre labels dans leur ordre de priorité, ainsi que les histogrammes exacts et agrégés avec masse,
largeur, bornes et représentants. Les cas `0..100` et `0..99 + 10000` matérialisent explicitement les
géométries historiquement divergentes recensées par l’audit. Leurs résultats sont eux aussi dérivés du
présent standard, du contrat sérialisé et de calculs indépendants.

Le runner partagé exécute les références dans les deux moteurs avec leurs seeds et `mca-prng-v1`, après
validation du schéma et du corpus. Les sorties sont comparées exactement dans la forme sérialisée commune,
sans tolérance, tri ou valeur absente reconstruite.

La matérialisation spécialisée du rejeu exact est la commande
`.venv\Scripts\python.exe Scripts/run_statistical_exact_replay.py` et son artefact déterministe
[`reports/statistical-exact-replay-evidence.json`](../../reports/statistical-exact-replay-evidence.json).
Elle exécute chaque référence dans TypeScript et dans Python selon plusieurs géométries de batch backend,
puis compare chaque sortie directement à `expected_result` avant la comparaison interlangage. La présence
des champs, les types primitifs JSON, les valeurs et l’ordre des distributions sont significatifs ; aucune
tolérance, aucun arrondi, aucun tri correctif et aucune normalisation silencieuse ne sont admis. Un
diagnostic localise le cas, le moteur, le batch, le chemin JSON, les états attendu et obtenu et qualifie
l’erreur de moteur, la divergence normative ou la divergence interlangage.

Cette matérialisation conserve séparément la nature de la preuve et l’enforcement. Un rejeu exact atteste
`STAT-PAR-002` à `STAT-PAR-004` pour les références exécutées ; il ne constitue pas une évaluation
distributionnelle au sens de `STAT-PAR-005`. Le corpus reste l’autorité de résultat et aucun moteur ou
batch ne peut servir d’oracle à un autre.

Les fabriques Python et TypeScript appliquent l’entrée normalisée fermée du contrat `1.0` :
types et bornes stricts, entiers finis positifs ou nuls, six observations utilisables, seed `uint32` et
présence exclusive du paramètre actif. Elles alignent aussi la forme canonique fermée et l’omission des valeurs
indisponibles, sans sentinelle. Les 22 sondes partagées en apportent une preuve interlangage. Les frontières
DTO, API, MongoDB et `localStorage` restent primitives.

Les censures, rangs, quantiles de survie et Risk Score sont alignés sans reconstruire les percentiles
absents. Les règles `STAT-PAR-030` à `STAT-PAR-035` sont portées par une autorité de domaine par langage :
moyenne et variance de population, quartiles linéaires, pente déterministe, normalisation `round half up`
avant les seuils et ordre exact des quatre labels. Une seizième référence démontre le cas de sept
observations en complément des preuves à six ; les résultats sont dérivés du présent standard et de
`mca-prng-v1` sans prendre un moteur comme oracle. L’état de conformité, les divergences et le caractère
informatif ou bloquant du contrôle sont publiés dans le
[`rapport de parité`](../../reports/statistical-parity-report.md), pas dans le présent standard.

La construction conforme des histogrammes réside dans une autorité de domaine par langage. Le validateur
indépendant reconstruit les tirages des cas à une semaine depuis `mca-prng-v1`, puis applique
`STAT-PAR-037` à `STAT-PAR-039` pour vérifier exactement représentants, effectifs, ordre et masse sans
prendre un moteur comme oracle. L’état observable et le niveau d’enforcement restent publiés uniquement
dans le rapport de parité.

### STAT-PAR-047 — Version de rejeu

Le contrat normatif **DOIT** porter la version `1.0`. Toute preuve ou donnée destinée au rejeu **DOIT**
permettre d'associer les entrées normalisées et la seed à cette version de contrat.

### STAT-PAR-048 — Évolution du contrat

Toute modification future susceptible de changer un tirage, une censure, un percentile, un score, un label,
un histogramme ou la forme d'une réponse **DOIT** entraîner une décision explicite de compatibilité, une mise
à jour de version, une mise à jour du corpus partagé et une migration ou une invalidation documentée des
historiques et caches concernés.

L’[autorité de compatibilité](../statistical-compatibility.md) **DOIT** relier les surfaces modifiées à leurs
versions, dépendances, empreintes sémantiques, preuves régénérées et traitements des résultats antérieurs.
Une empreinte seule, un corpus seul ou l’accord simultané de deux moteurs **NE DOIT PAS** valoir décision.

### STAT-PAR-049 — Adoption et preuve de conformité

L’adoption documentaire du présent standard **NE DOIT PAS** être interprétée comme une preuve
d’implémentation. La séparation des DTO, les Value Objects, le PRNG commun, le corpus partagé, l’alignement
des moteurs, la gate de parité, les décisions de migration et la consommation fidèle par l’UI et les PDF
**DOIVENT** être démontrés par des contrats, des tests et des rapports observables avant de revendiquer la
conformité d’exécution.

## 13. Traçabilité des exigences

Le standard reste l’autorité normative. Les documents suivants portent les responsabilités complémentaires
sans redéfinir ses règles :

- le [corpus de référence](../statistical-reference-corpus.md) relie les exigences aux cas, aux dérivations
  indépendantes et à leur exécution interlangage ;
- l’[audit de parité](../statistical-parity-audit.md) conserve l’inventaire historique des responsabilités
  `ST-01` à `ST-51`, des divergences et des décisions qui ont conduit au standard ;
- l’[architecture](../../ARCHITECTURE.md) décrit les frontières DTO, domaine, persistance et présentation ;
- le [rapport de parité](../../reports/statistical-parity-report.md) publie l’état observable des moteurs ;
- la [matrice risques–contrôles](../risk-control-matrix.md) suit la maîtrise courante et les traitements
  futurs ;
- le [backlog](../backlog.md) reste seul responsable du statut, des priorités, dépendances et dates des
  outcomes futurs.

| Famille normative | Exigences | Preuve spécialisée |
| --- | --- | --- |
| Niveaux de parité, seed et tirages | `STAT-PAR-001` à `STAT-PAR-010` | Vecteurs `mca-prng-v1`, tests des ports et corpus de rejeu |
| Préparation des données | `STAT-PAR-011` à `STAT-PAR-017` | Schéma du corpus, sondes de validation et mappers |
| Modes, censures et percentiles | `STAT-PAR-018` à `STAT-PAR-025` | Cas normatifs de délai et de capacité |
| Risk Score et fiabilité | `STAT-PAR-026` à `STAT-PAR-035` | Cas de score, métriques, seuils et labels |
| Histogrammes et forme de réponse | `STAT-PAR-036` à `STAT-PAR-043` | Cas exacts et agrégés, comparateur interlangage |
| Frontière de parité | `STAT-PAR-044` à `STAT-PAR-046` | Architecture et tests des consommateurs |
| Versionnement, évolution et preuve | `STAT-PAR-047` à `STAT-PAR-049` | Version du corpus, décisions de compatibilité et rapports |

## 14. État d’adoption

Le présent standard n’incorpore pas un compteur de conformité ni une chronologie de fabrication. L’état
courant est consultable dans le rapport de parité et la matrice risques–contrôles. Cette séparation empêche
qu’une norme stable devienne une seconde autorité de statut ou un changelog.

Une revendication de conformité exige des preuves exécutables couvrant l’entrée normalisée, le PRNG,
l’ordre des tirages, les deux modes, les censures, les percentiles, le Risk Score, la fiabilité, les
histogrammes, la forme commune, le versionnement et la consommation fidèle des résultats. Une divergence
connue ou un contrôle seulement informatif doit rester visible dans les documents de preuve.
