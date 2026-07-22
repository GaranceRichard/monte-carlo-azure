# Standard de parité et de reproductibilité statistiques

**Référence :** STD-STAT-001
**Version :** 1.0
**Statut :** Standard projet
**Titre :** Standard de parité et de reproductibilité statistiques
**Périmètre :** moteur Monte Carlo Python, moteur local TypeScript, contrat statistique commun et restitution des résultats normatifs

---

## 1. Objet et autorité

Le présent standard tranche les décisions ouvertes par l'[audit de parité statistique du PBI 2.1](../statistical-parity-audit.md).
Il définit la cible contractuelle commune préalable aux PBI 2.3 à 2.8. Il ne décrit pas le comportement
actuel comme déjà conforme et n'aligne aucun moteur dans le cadre du PBI 2.2.

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

## 12. Versionnement et compatibilité

### STAT-PAR-047 — Version de rejeu

Le contrat normatif **DOIT** porter la version `1.0`. Toute preuve ou donnée destinée au rejeu **DOIT**
permettre d'associer les entrées normalisées et la seed à cette version de contrat.

### STAT-PAR-048 — Évolution du contrat

Toute modification future susceptible de changer un tirage, une censure, un percentile, un score, un label,
un histogramme ou la forme d'une réponse **DOIT** entraîner une décision explicite de compatibilité, une mise
à jour de version, une mise à jour du corpus partagé et une migration ou une invalidation documentée des
historiques et caches concernés.

### STAT-PAR-049 — Limite du PBI 2.2

Le PBI 2.2 **NE DOIT PAS** être interprété comme l'implémentation de la séparation des DTO, des Value Objects,
de l'injection ou du choix du PRNG commun, des fixtures partagées, de l'alignement des moteurs, de la gate de
parité, des migrations de données ou des changements UI/PDF. Ces travaux **DOIVENT** être réalisés par les
PBI 2.3 à 2.8 selon les matrices ci-dessous avant de revendiquer la conformité d'exécution à ce standard.

## 13. Orientation des exigences vers les PBI d'implémentation

Une exigence peut relever de plusieurs PBI : le total par PBI n'est donc pas une partition des 49 exigences.

| Exigence | PBI d'implémentation |
| --- | --- |
| STAT-PAR-001 | 2.6, 2.8 |
| STAT-PAR-002 | 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-003 | 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-004 | 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-005 | 2.6, 2.8 |
| STAT-PAR-006 | 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-007 | 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-008 | 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-009 | 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-010 | 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-011 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-012 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-013 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-014 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-015 | 2.3, 2.6, 2.7, 2.8 |
| STAT-PAR-016 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-017 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-018 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-019 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-020 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-021 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-022 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-023 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-024 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-025 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-026 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-027 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-028 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-029 | 2.3, 2.6, 2.7, 2.8 |
| STAT-PAR-030 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-031 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-032 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-033 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-034 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-035 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-036 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-037 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-038 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-039 | 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-040 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-041 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-042 | 2.3, 2.4, 2.6, 2.7, 2.8 |
| STAT-PAR-043 | 2.3, 2.6, 2.7, 2.8 |
| STAT-PAR-044 | 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-045 | 2.3, 2.6, 2.7, 2.8 |
| STAT-PAR-046 | 2.3, 2.6, 2.7, 2.8 |
| STAT-PAR-047 | 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-048 | 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 |
| STAT-PAR-049 | 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 |

## 14. Traçabilité avec les responsabilités de l'audit PBI 2.1

La colonne « PBI » indique où la décision doit être matérialisée ou contrôlée. Pour une responsabilité
frontend-only, elle indique où référencer la frontière sans créer d'équivalent Python.

| Responsabilité | Exigence normative | Décision retenue | PBI |
| --- | --- | --- | --- |
| ST-01 | STAT-PAR-012, STAT-PAR-015, STAT-PAR-017, STAT-PAR-040, STAT-PAR-041 | Contrat strict, entièrement résolu, extras refusés et absences omises. | 2.3, 2.4, 2.6 |
| ST-02 | STAT-PAR-014 | Bornes actuelles conservées comme bornes communes. | 2.4, 2.6 |
| ST-03 | STAT-PAR-016 | Paramètre actif obligatoire ; paramètre inactif sans effet. | 2.3, 2.4, 2.6 |
| ST-04 | STAT-PAR-014 | Historique brut limité à 6..521 valeurs. | 2.4, 2.6 |
| ST-05 | STAT-PAR-013, STAT-PAR-014 | Minimum de six valeurs après traitement explicite des zéros. | 2.4, 2.6 |
| ST-06 | STAT-PAR-012, STAT-PAR-013, STAT-PAR-035 | Rejet global des invalides avant filtrage métier des zéros. | 2.3, 2.4, 2.6, 2.7 |
| ST-07 | STAT-PAR-012 | Entiers stricts ; aucune troncature ni coercion numérique. | 2.3, 2.4, 2.6, 2.7 |
| ST-08 | STAT-PAR-014 | Entiers bornés pour objectifs et volume de simulation. | 2.4, 2.6 |
| ST-09 | STAT-PAR-007 à STAT-PAR-010 | Seed uint32 explicite et jamais normalisée silencieusement. | 2.4, 2.5, 2.6, 2.7 |
| ST-10 | STAT-PAR-017 | Défauts permis aux frontières, contrat moteur toujours explicite. | 2.3, 2.4, 2.6 |
| ST-11 | STAT-PAR-006, STAT-PAR-010 | Génération propre à l'environnement permise ; seed résolue rejouable. | 2.5, 2.6 |
| ST-12 | STAT-PAR-002, STAT-PAR-003, STAT-PAR-007 | PRNG contractuel commun requis pour le rejeu interlangage. | 2.5, 2.6, 2.7, 2.8 |
| ST-13 | STAT-PAR-002, STAT-PAR-047 | Rejeu exact lié à la seed et à la version du contrat. | 2.5, 2.6, 2.8 |
| ST-14 | STAT-PAR-003, STAT-PAR-004, STAT-PAR-018, STAT-PAR-019 | Ordre et consommation communs, indépendants du batching. | 2.5, 2.6, 2.7, 2.8 |
| ST-15 | STAT-PAR-018 | Arrêt, semaine initiale et fin exacte à l'horizon figés. | 2.6, 2.7, 2.8 |
| ST-16 | STAT-PAR-020 à STAT-PAR-022, STAT-PAR-042 | Censure séparée des durées et résumée explicitement. | 2.4, 2.6, 2.7, 2.8 |
| ST-17 | STAT-PAR-002 à STAT-PAR-005, STAT-PAR-020 à STAT-PAR-022 | Rejeu exact prioritaire ; multi-seeds complémentaire au rang censuré. | 2.5, 2.6, 2.7, 2.8 |
| ST-18 | STAT-PAR-019 | Nombre exact de tirages et somme entière. | 2.6, 2.7, 2.8 |
| ST-19 | STAT-PAR-021, STAT-PAR-022 | Rang conservateur et identifiabilité explicite en mode backlog. | 2.4, 2.6, 2.7, 2.8 |
| ST-20 | STAT-PAR-020 à STAT-PAR-022 | Rang calculé sur `n_sims`, censures exclues des durées terminées. | 2.4, 2.6, 2.7, 2.8 |
| ST-21 | STAT-PAR-023 | Quantile de survie discret conservateur. | 2.4, 2.6, 2.7, 2.8 |
| ST-22 | STAT-PAR-024, STAT-PAR-040 | Contrat public fermé à P50/P70/P90 dans la version 1.0. | 2.3, 2.4, 2.6 |
| ST-23 | STAT-PAR-025 | Invariants d'ordre sans fabrication des absences. | 2.4, 2.6, 2.8 |
| ST-24 | STAT-PAR-026, STAT-PAR-027 | P50 et P90 requis ; formules par mode figées. | 2.4, 2.6, 2.7, 2.8 |
| ST-25 | STAT-PAR-028, STAT-PAR-029 | Score d'autorité arrondi à quatre décimales, non recalculé. | 2.3, 2.4, 2.6, 2.7 |
| ST-26 | STAT-PAR-029, STAT-PAR-045, STAT-PAR-046 | Légende frontend-only fondée sur le score normatif reçu. | 2.4, 2.6, 2.8 |
| ST-27 | STAT-PAR-030, STAT-PAR-032 | Moments de population et valeur normalisée commune. | 2.4, 2.6, 2.7, 2.8 |
| ST-28 | STAT-PAR-030 | Quartiles linéaires et ratio interquartile communs. | 2.4, 2.6, 2.7, 2.8 |
| ST-29 | STAT-PAR-031, STAT-PAR-032 | Formule de pente déterministe, indépendante de `polyfit`. | 2.4, 2.6, 2.7, 2.8 |
| ST-30 | STAT-PAR-032 à STAT-PAR-034 | Seuils appliqués après normalisation commune et dans l'ordre fixé. | 2.4, 2.6, 2.7, 2.8 |
| ST-31 | STAT-PAR-012, STAT-PAR-035 | Non-finis rejetés avant tout helper de fiabilité. | 2.3, 2.4, 2.6, 2.7 |
| ST-32 | STAT-PAR-037 | Bucket exact jusqu'à 100 valeurs distinctes. | 2.4, 2.6, 2.7, 2.8 |
| ST-33 | STAT-PAR-038, STAT-PAR-039 | Largeur, rattachement et représentant agrégés figés. | 2.4, 2.6, 2.7, 2.8 |
| ST-34 | STAT-PAR-039 | Masse, comptes, ordre et absence de buckets vides protégés. | 2.4, 2.6, 2.8 |
| ST-35 | STAT-PAR-020 à STAT-PAR-022, STAT-PAR-045, STAT-PAR-046 | Courbe frontend-only alimentée par la censure normative. | 2.6, 2.8 |
| ST-36 | STAT-PAR-023, STAT-PAR-045, STAT-PAR-046 | Courbe de survie frontend-only alimentée par les résultats normatifs. | 2.6, 2.8 |
| ST-37 | STAT-PAR-036, STAT-PAR-041, STAT-PAR-043, STAT-PAR-045, STAT-PAR-046 | Aucun percentile normatif reconstruit depuis un histogramme legacy. | 2.3, 2.6, 2.8 |
| ST-38 | STAT-PAR-040 à STAT-PAR-042 | Forme commune et omission des valeurs absentes. | 2.3, 2.4, 2.6, 2.8 |
| ST-39 | STAT-PAR-041, STAT-PAR-043, STAT-PAR-048 | Persistance fidèle et migration/invalidation versionnée. | 2.3, 2.6, 2.8 |
| ST-40 | STAT-PAR-002, STAT-PAR-006, STAT-PAR-009, STAT-PAR-041, STAT-PAR-043, STAT-PAR-048 | Historique local fidèle, seed exacte et compatibilité décidée. | 2.3, 2.5, 2.6, 2.8 |
| ST-41 | STAT-PAR-011, STAT-PAR-045, STAT-PAR-046 | Semaines complètes frontend-only ; samples normalisés à l'entrée du cœur. | 2.6, 2.8 |
| ST-42 | STAT-PAR-045, STAT-PAR-046 | Bootstrap portefeuille frontend-only, sans équivalent Python. | 2.6, 2.8 |
| ST-43 | STAT-PAR-045, STAT-PAR-046 | Scénario Arrimé frontend-only, consommateur du cœur commun. | 2.6, 2.8 |
| ST-44 | STAT-PAR-045, STAT-PAR-046 | Friction frontend-only, sans extension artificielle du moteur. | 2.6, 2.8 |
| ST-45 | STAT-PAR-045, STAT-PAR-046 | Intersection corrélée frontend-only, en amont du cœur. | 2.6, 2.8 |
| ST-46 | STAT-PAR-026, STAT-PAR-029, STAT-PAR-043, STAT-PAR-045, STAT-PAR-046 | Diagnostic frontend-only sans altération des absences ni du score. | 2.3, 2.6, 2.8 |
| ST-47 | STAT-PAR-043, STAT-PAR-045, STAT-PAR-046 | Sensibilité des fenêtres hors cœur, résultats normatifs préservés. | 2.6, 2.8 |
| ST-48 | STAT-PAR-043, STAT-PAR-045, STAT-PAR-046 | Diagnostic comparatif hors cœur, sans modification des résultats. | 2.6, 2.8 |
| ST-49 | STAT-PAR-045, STAT-PAR-046 | Cycle Time explicitement non comparable et hors contrat. | 2.8 |
| ST-50 | STAT-PAR-036, STAT-PAR-043, STAT-PAR-045, STAT-PAR-046 | Lissage de présentation séparé de la distribution d'autorité. | 2.6, 2.8 |
| ST-51 | STAT-PAR-029, STAT-PAR-036, STAT-PAR-041, STAT-PAR-043, STAT-PAR-046 | UI/PDF consommateurs, sans recalcul normatif divergent. | 2.3, 2.6, 2.7, 2.8 |

## 15. Séquence de mise en œuvre

La mise en conformité est répartie comme suit :

- **2.3** : séparer DTO, modèles statistiques et formes de persistance ;
- **2.4** : introduire les Value Objects de seed, entrées, percentiles, fiabilité, histogramme et complétion ;
- **2.5** : injecter les sources variables et adopter le PRNG contractuel ;
- **2.6** : construire le corpus partagé couvrant règles déterministes, censure, limites et rejeu ;
- **2.7** : aligner les deux moteurs et les consommateurs sur la version `1.0` ;
- **2.8** : rendre la parité, les invariants et la compatibilité bloquants.

Avant l'achèvement de ces PBI, le standard constitue la cible adoptée, pas une preuve que les moteurs
existants satisfont déjà la parité de rejeu.
