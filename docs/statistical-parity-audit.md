# Audit de parité statistique Python / TypeScript — PBI 2.1

Date de l'audit : 22 juillet 2026

Périmètre : PBI **2.1 — Auditer les divergences statistiques Python et TypeScript**

## 1. Objet et périmètre

Cet audit cartographie les responsabilités statistiques du dépôt, les chemins qui les exécutent et les
écarts observables entre Python et TypeScript. Il ne définit pas le comportement qui devra faire foi et
n'introduit aucune correction, aucun alignement, aucun contrat partagé, aucun corpus permanent et aucune
gate de parité.

La lecture des preuves utilise les qualificatifs suivants :

- **Fait confirmé dans le code (`CODE`)** : comportement directement lisible dans le workspace courant.
- **Résultat expérimental (`EXP`)** : sortie reproduite par une commande ponctuelle sous `.tmp/`.
- **Inférence (`INF`)** : conséquence plausible déduite du code et/ou d'une expérience, non observée dans
  une décision utilisateur réelle.
- **Inconnu (`INCONNU`)** : le dépôt ou les expériences ne permettent pas de conclure.
- **Décision normative future (`NORM`)** : règle à trancher dans le PBI 2.2 avant tout alignement.

Une différence d'implémentation n'est classée comme divergence produit que lorsqu'un même objectif métier
peut raisonnablement recevoir un résultat ou un diagnostic différent selon le chemin. Les calculs de Cycle
Time, de préparation ADO, de scénarios portefeuille et de restitution sont inventoriés, mais ne sont pas
assimilés au moteur Monte Carlo Python lorsqu'ils servent un autre usage.

### Cadrage confirmé

- `CODE` : le PBI 2.1 était initialement non réalisé dans `docs/backlog.md`.
- `CODE` : la Feature 2 veut formaliser les règles communes, supprimer les divergences involontaires et
  protéger les invariants par des contrats et références partagés.
- `CODE` : `RISK-003`, `RISK-004` et `RISK-005` couvrent respectivement la divergence interlangage, les
  erreurs de percentiles/censures/score/histogramme et la dérive de contrat.
- `CODE` : les conclusions doivent alimenter 2.2 à 2.8; aucun de ces travaux n'est réalisé ici.

## 2. Résumé exécutif

L'audit recense **51 responsabilités**. Les règles déterministes centrales sont beaucoup plus proches que
ne le suggère la coexistence de deux fichiers moteurs : bornes partagées, simulations constantes,
conditions d'arrêt, censure explicite, rang des percentiles, quantiles de survie, formules de score lorsque
P50 et P90 sont présents, moments de fiabilité et invariants métier concordent sur les cas vérifiés.
L'égalité exacte seed-à-seed n'existe pas, car les PRNG et les ordres de tirage diffèrent. Une analyse de
sensibilité sur 1 000 seeds distingue désormais la variabilité d'échantillonnage de toute affirmation de
biais interlangage.

### Comptes par statut

| Statut | Nombre |
| --- | ---: |
| `equivalent_demonstrated` | 19 |
| `intentional_difference` | 1 |
| `observable_non_decisional` | 4 |
| `potentially_decisional_divergence` | 3 |
| `normative_decision_required` | 6 |
| `single_engine_by_design` | 16 |
| `not_comparable` | 2 |
| **Total** | **51** |

### Comptes par sévérité

| Sévérité | Nombre |
| --- | ---: |
| `critical` | 1 |
| `high` | 11 |
| `moderate` | 9 |
| `low` | 5 |
| `none` | 25 |
| **Total** | **51** |

### Cinq principaux risques

1. `CODE/EXP` — près d'un rang de censure, P90 bascule avec l'échantillonnage dans les deux moteurs. Sur
   1 000 seeds, aucune différence systématique interlangage n'est démontrée, mais 39,8 % des paires de seeds
   numériques donnent une disponibilité différente de P90. De plus, lorsque P50 existe mais P90 manque,
   Python omet le score tandis que TypeScript produit systématiquement `0` (`critical`).
2. `EXP` — pour des historiques entiers exactement placés sur les seuils de pente, les métriques arrondies
   sont identiques mais les labels Python et TypeScript diffèrent (`fiable`/`incertain` puis
   `incertain`/`fragile`) (`high`).
3. `CODE` — aucune décision normative ne dit si une seed doit reproduire seulement son moteur, être égale
   interlangage ou seulement produire une distribution équivalente (`high`).
4. `EXP` — à 101 valeurs distinctes, Python produit 100 buckets et TypeScript 51; sur une plage discontinue,
   les centres deviennent `50/9951` contre `51/10050` (`moderate`).
5. `CODE`/`EXP` — les contrats divergent pour les décimaux, non-finis, champs supplémentaires, valeurs par
   défaut et seeds hors domaine; les appelants actuels masquent plusieurs de ces différences, sans contrat
   normatif partagé (`moderate`).

### Principales décisions normatives et prochaines étapes

- définir les niveaux de parité exigés : auto-reproductibilité, égalité interlangage, équivalence
  distributionnelle et équivalence décisionnelle;
- choisir la convention de comparaison aux seuils de fiabilité et le moment de l'arrondi;
- fixer le contrat d'entrée exact, notamment coercions, décimaux, non-finis, seeds et champs supplémentaires;
- fixer la restitution d'un percentile censuré et interdire ou autoriser explicitement un Risk Score sans
  P90, puis fixer la précision du score exposé;
- fixer l'algorithme d'agrégation des histogrammes;
- formaliser les responsabilités volontairement frontend-only avant de construire le corpus 2.6;
- ensuite seulement : injecter l'aléatoire (2.5), créer les références (2.6), aligner (2.7) et bloquer les
  régressions (2.8).

## 3. Méthode

1. Lecture du cadrage produit, architecture, backlog, risques, chemins critiques et DoD.
2. Recherche globale des calculs, validations, arrondis, aléas, persistances et transformations de
   restitution.
3. Traçage des appelants backend, démo, portefeuille, historique local, historique Mongo, UI et PDF.
4. Exécution de scripts temporaires Python et TypeScript compilé en CommonJS sous `.tmp/`.
5. Comparaison de cas déterministes, percentiles, seuils de fiabilité, histogrammes et quatre seeds, puis
   analyse de sensibilité ciblée sur 1 000 seeds au rang censuré.
6. Exécution des tests ciblés existants, sans modifier les tests ni les moteurs.

Les expériences utilisent Python 3.12.10 dans `.venv`, Node 24.13.0, NumPy installé dans le projet et le
TypeScript courant compilé par `frontend/node_modules/typescript`. Elles ne constituent pas un corpus de
référence et ne doivent pas être reprises comme norme sans PBI 2.2.

## 4. Chemins d'exécution

### Backend

```text
frontend standard
  → simulationForecastCore.simulateForecastFromSamplesCore(demoMode=false)
  → validateSimulationInputContract (prévalidation frontend)
  → postSimulate
  → POST /simulate
  → SimulateRequest (Pydantic)
  → filtrage des samples et minimum de 6 valeurs utilisables
  → _resolve_simulation_seed
  → _compute_simulation_result
  → mc_finish_weeks ou mc_items_done_for_weeks (Python)
  → percentiles + risk_score + histogram_buckets + throughput_reliability
  → SimulateResponse
  → éventuelle persistance Mongo asynchrone
  → ForecastResponse frontend
```

`CODE` : ce chemin est utilisé hors démo, y compris pour les équipes et scénarios portefeuille d'une
application standard. Le frontend prépare les samples; le calcul Monte Carlo final est Python.

### Local frontend

```text
mode démo
  → simulationForecastCore.simulateForecastFromSamplesCore(demoMode=true)
  → validateSimulationInputContract
  → simulateMonteCarloLocal (TypeScript)
  → ForecastResponse
```

`CODE` : le moteur TypeScript est substituable au moteur Python seulement pour le calcul Monte Carlo à
partir de samples déjà préparés. La source démo et le backend réel ne collectent pas le même contexte, mais
la fonction accepte les mêmes paramètres statistiques, ce qui permet une comparaison contrôlée.

### Portefeuille

```text
historiques d'équipes
  → fetchTeamThroughput (démo ou ADO)
  → buildScenarioSamples / buildCorrelatedPortfolioWeeklyThroughputs (TypeScript)
  → samples Indépendant / Arrimé / Friction / Historique corrélé
  → simulateForecastFromSamples
       → TypeScript si démo
       → POST /simulate / Python sinon
  → recomposition des Risk Scores et diagnostics en TypeScript
  → rapport PDF
```

`CODE` : préparation des hypothèses et diagnostics est complémentaire au moteur, pas substituable. Les
scénarios standard utilisent Python après une préparation TypeScript; les mêmes scénarios en démo utilisent
TypeScript de bout en bout. Une même entrée statistique peut donc obtenir une décision issue de chemins
différents lorsque `demoMode` change.

### Responsabilités mono-moteur par conception

- frontend : collecte ADO, semaines complètes, Cycle Time, scénarios portefeuille, diagnostics, courbes,
  lissage, historique contextualisé, UI et PDF;
- backend : rate limit, timeout, génération cryptographique serveur de seed, persistance Mongo anonyme et
  historique serveur;
- non comparable : un diagnostic ou une transformation de présentation n'est pas un équivalent du moteur
  NumPy simplement parce qu'il contient une moyenne, une pente ou un percentile.

## 5. Inventaire des responsabilités

Abréviations de tests : `PY-core` = `tests/test_mc_core.py`; `PY-api` = `tests/test_api_simulate.py`;
`PY-hist` = `tests/test_api_history.py` et `tests/test_simulation_store.py`; `TS-core` =
`frontend/src/utils/simulation.test.ts`; `TS-service` =
`frontend/src/hooks/Simulationforecastservice.test.tsx`; `TS-port` =
`frontend/src/hooks/usePortfolioReport.test.tsx`; `TS-view` = tests de probabilités, graphiques, résultats et
rapports.

| ID | Responsabilité | Python | TypeScript | Appelants et chemin de production | Tests existants | Présence / conséquence potentielle |
| --- | --- | --- | --- | --- | --- | --- |
| ST-01 | Forme, types, coercions, extras et défauts du contrat | `SimulateRequest` | `ForecastRequestPayload`, `validateSimulationInputContract` | API et service forecast | PY-api, TS-service | Deux contrats; disponibilité différente sur entrées atypiques. |
| ST-02 | Valeurs des bornes | `simulation_limits.py` | `simulationLimits.ts` | validation API/UI/local | PY-api, TS-core/service | Deux moteurs; coût et domaine calculables. |
| ST-03 | Paramètre requis par mode | `validate_mode_requirements` | `validateSimulationInputContract` | avant simulation | PY-api, TS-core/service | Deux moteurs; empêche objectif absent. |
| ST-04 | Taille brute historique 6..521 | validateur Pydantic | validateur TS | frontière calcul | PY-api, TS-core/service | Deux moteurs; volume borné. |
| ST-05 | Minimum de 6 samples après filtre | route `simulate` | validateur TS et `fetchTeamThroughputCore` | API/démo/ADO | PY-api, TS-service | Deux moteurs; calcul refusé si historique insuffisant. |
| ST-06 | Non-finis, négatifs et zéros | Pydantic puis filtre route/core | `Number.isFinite` puis filtre | entrée et diagnostics | PY-api/core, TS-core/service | Deux moteurs; divergence de rejet/filtrage atypique. |
| ST-07 | Décimaux et conversion entière | Pydantic refuse fraction; core `dtype=int` | local `Math.floor` | helper local ou API | PY-core/api, TS-core | Deux moteurs; succès local possible contre 422 backend. |
| ST-08 | Entiers bornés `n_sims`, backlog, horizon | Pydantic | `validateBoundedInteger` | tous calculs | PY-api, TS-core/service | Deux moteurs; bornes identiques. |
| ST-09 | Domaine et validation de seed | champ Pydantic 32 bits | aucune validation locale; `>>> 0` dans le PRNG | replay et simulation | PY-api, TS-core | Deux moteurs; seed retournée hors contrat possible localement. |
| ST-10 | Défauts `n_sims` / `include_zero_weeks` | `20000` / `false` | `nSims` requis; local `includeZeroWeeks=true` | appels directs; service explicite | PY-api, TS-core/service | Défauts différents, masqués par les appelants courants. |
| ST-11 | Seed automatique | `secrets.randbelow` | Web Crypto puis `Date.now` | serveur ou navigateur | PY-api, TS-core | Mono par environnement; reproductibilité tracée par réponse. |
| ST-12 | Algorithme PRNG et espace seed | `default_rng`/PCG64 | Mulberry32 32 bits | moteur Python/local | PY-core, TS-core | Deux moteurs; pas d'égalité seed-à-seed. |
| ST-13 | Reproductibilité interne | générateur unique seedé | générateur unique seedé | rejeu | PY-core/api, TS-core/history | Deux moteurs; même moteur/même seed stable. |
| ST-14 | Remplacement, ordre et batching | indices NumPy en lots | tirages séquentiels jusqu'à arrêt | boucle Monte Carlo | PY-core, TS-core | Règle bootstrap commune; séquences exactes différentes. |
| ST-15 | Arrêt backlog, semaine 1, horizon 521, fin exacte | `mc_finish_weeks` | boucle locale | mode backlog | PY-core/api, TS-core | Deux moteurs; délai et censure. |
| ST-16 | Censure, distribution des seuls terminés | `FinishWeeksSimulation` + route | `completedFlags` + filtre | réponse/UI | PY-api, TS-core/probability | Deux moteurs; masse visible et taux de complétion. |
| ST-17 | Tirage près du rang censuré | PCG64 | Mulberry32 | mode backlog démo/backend | aucune parité | Deux moteurs; P90/score/diagnostic peuvent apparaître sur un seul chemin. |
| ST-18 | Nombre de tirages et somme `weeks_to_items` | `mc_items_done_for_weeks` | boucle `targetWeeks` | mode capacité | PY-core/api, TS-core | Deux moteurs; capacité projetée. |
| ST-19 | Quantile backlog `higher` sans censure | `np.quantile(...higher)` | `discreteQuantile(...higher)` | percentiles | PY-core, TS-core | Deux moteurs; délai conservateur. |
| ST-20 | Rang backlog sur population totale censurée | rang `ceil(p*n_sims)` | même rang | percentiles censurés | PY-core/api, TS-core | Deux moteurs; identifiabilité. |
| ST-21 | Quantile de survie items `lower` | q=`(100-p)/100` | même q | percentiles capacité | PY-core/api, TS-core/probability | Deux moteurs; capacité prudente. |
| ST-22 | Ensemble de percentiles et typage | fonction arbitraire; API 50/70/90 | fonction arbitraire; type 50/70/90 | moteur/DTO | PY-core, TS-core | Convention non encapsulée; P80/P85/P100 hors DTO. |
| ST-23 | Invariants d'ordre | conséquence des quantiles | conséquence des quantiles | affichage | PY-core, TS-core | Deux moteurs; cohérence P50/P70/P90. |
| ST-24 | Formule, gardes et plancher Risk Score | `risk_score` | `computeRiskScoreFromPercentiles` | API, UI, portfolio, PDF | PY-core/api, TS-core/port | Deux moteurs; dispersion décisionnelle. |
| ST-25 | Précision du Risk Score | flottant natif | local arrondi à 4 décimales | réponse; UI/PDF recalculent | PY-api, TS-core/view | Écart visible dans le DTO, impact aval non démontré. |
| ST-26 | Catégorie du Risk Score | — | `computeRiskLegend` | UI/portfolio/diagnostic | TS-core/diagnostics | Frontend-only; interprétation du score. |
| ST-27 | Moyenne, variance population, écart-type | NumPy `mean/std` | réductions `/ n` | fiabilité | PY-core, TS-core | Deux moteurs; métriques concordantes. |
| ST-28 | Q25, médiane, Q75, IQR relatif | `np.percentile` linéaire | interpolation linéaire | fiabilité | PY-core, TS-core | Deux moteurs; dispersion historique. |
| ST-29 | Régression, pente et pente normalisée | `np.polyfit` | covariance/variance explicite | fiabilité | PY-core, TS-core | Deux moteurs; valeurs arrondies concordantes sur cas vérifiés. |
| ST-30 | Seuils, priorité et historique court | états composés puis garde `<8` | branches directes puis garde `<8` | label de fiabilité | PY-core, TS-core/diagnostics | Deux moteurs; labels divergents aux frontières flottantes. |
| ST-31 | Non-finis dans le helper de fiabilité | propage `NaN` en appel direct | filtre puis calcule | hors API normale | tests partiels TS | Entrées de helper non comparables au chemin API. |
| ST-32 | Histogramme exact `<=100` distincts | `np.unique` | `Map` triée | réponse | PY-core, TS-core | Deux moteurs; équivalent. |
| ST-33 | Histogramme agrégé `>100` | 100 bins réels NumPy | largeur entière `ceil` | réponse/courbes/PDF | PY-core, TS-core/view | Deux moteurs; géométrie différente. |
| ST-34 | Masse, ordre, vides | bins vides omis, tri | Map non vide, tri | graphiques | PY-core, TS-core | Deux moteurs; masse conservée. |
| ST-35 | CDF backlog plafonnée par censures | — | `buildProbabilityCurve` avec total global | UI/PDF | TS-view | Restitution frontend-only. |
| ST-36 | Courbe de survie items | — | `buildProbabilityCurve` décroissante | UI/PDF | TS-view | Restitution frontend-only. |
| ST-37 | Réparation percentiles items legacy | — | `buildAtLeastPercentiles` sur buckets | historique ancien | TS-view | Migration frontend-only, approximation possible si agrégé. |
| ST-38 | Forme de réponse et omission des absents | `exclude_none=True` | `undefined` omis au JSON | API/local | PY-api, TS-service/api | Wire courant équivalent sur absences. |
| ST-39 | Persistance statistique Mongo | `SimulationStore.save_simulation` | — | historique serveur | PY-hist | Backend-only; score non persisté, seed/percentiles oui. |
| ST-40 | Historique local contextualisé et replay | — | `useSimulationHistory`, `runSimulationForecastCore` | navigateur | tests history/service | Frontend-only; conserve `ForecastResponse` et seed. |
| ST-41 | Semaines ADO complètes et throughput | — | `getTeamDeliveryDataDirect`, dates ISO | préparation | `adoClient.test.ts`, `date.test.ts` | Frontend-only par frontière d'identité; biaise toute projection si faux. |
| ST-42 | Bootstrap portefeuille indépendant | — | `buildScenarioSamples.optimistic` | portefeuille | TS-core/port | Frontend-only; capacité multi-équipe. |
| ST-43 | Scénario Arrimé | — | somme × taux, `floor` | portefeuille | TS-core/port | Frontend-only; capacité dépend d'une entrée utilisateur. |
| ST-44 | Friction | — | taux^(équipes-1), `floor`, % arrondi | portefeuille | TS-core/port | Frontend-only; arbitrage multi-équipe. |
| ST-45 | Historique corrélé | — | intersection semaines + somme | portefeuille | TS-core/port | Frontend-only; conserve variations communes observées. |
| ST-46 | Qualité des données et incertitude | — | `forecastDiagnostics` | diagnostic simulation | tests diagnostics/view | Frontend-only; peut bloquer ou dégrader la recommandation. |
| ST-47 | Sensibilité aux fenêtres historiques | — | `diagnoseHistoricalWindowSensitivity` | historique local | tests diagnostics/view | Frontend-only; choix de référence prudente/récente. |
| ST-48 | Diagnostic comparatif portefeuille | — | `buildPortfolioComparisonDiagnostic` | PDF portefeuille | tests diagnostic/port | Frontend-only; ne recommande volontairement aucun scénario. |
| ST-49 | Cycle Time et tendance glissante | — | `cycleTime.ts` | collecte/UI/PDF | `cycleTime.test.ts` | Statistique différente, non comparable au Monte Carlo Python. |
| ST-50 | Lissage visuel histogramme | — | `smoothHistogramCounts` | UI | chart-data tests | Présentation frontend-only; compte brut conservé à part. |
| ST-51 | Recalculs de restitution PDF/UI | — | score, fiabilité, probabilités | résultats et rapports | TS-view | Frontend-only; peut masquer la précision DTO mais garde les percentiles. |

## 6. Matrice Python/TypeScript

Chaque ligne emploie exactement un statut et une sévérité autorisés. « PBI » indique le traitement futur,
pas un travail réalisé pendant l'audit.

| ID | Statut | Sévérité | Preuve et exemple reproductible | Impact | Recommandation | PBI |
| --- | --- | --- | --- | --- | --- | --- |
| ST-01 | `normative_decision_required` | `moderate` | `CODE/EXP` : Pydantic coercit les chaînes numériques et refuse les extras; TS filtre les chaînes et ignore les extras. | Acceptation différente hors appelants typés. | Définir le wire contract exact. | 2.2, 2.3, 2.6 |
| ST-02 | `equivalent_demonstrated` | `none` | `CODE/EXP` : 1000..200000, 1..521, 6..521, 1..1000000 identiques. | Aucun écart vérifié. | Mettre ces bornes dans le futur contrat. | 2.2, 2.4, 2.6 |
| ST-03 | `equivalent_demonstrated` | `none` | `EXP` : backlog/target absent rejeté selon le mode; paramètre inactif toléré. | Aucun écart de calcul actif. | Figer la règle sur le champ inactif. | 2.2, 2.6 |
| ST-04 | `equivalent_demonstrated` | `none` | `EXP` : 5 et 522 rejetés; 6 et 521 acceptés. | Aucun écart vérifié. | Corpus de bornes partagé. | 2.6, 2.8 |
| ST-05 | `equivalent_demonstrated` | `none` | `EXP` : `[0,1,2,3,4,5]` rejeté si zéro exclu, accepté s'il est inclus. | Aucun écart vérifié. | Conserver le cas dans 2.6. | 2.6, 2.8 |
| ST-06 | `normative_decision_required` | `moderate` | `CODE/EXP` : API rejette tout non-fini; TS peut l'écarter si six autres valeurs restent. | Calcul local possible contre rejet backend. | Choisir rejet global ou filtrage. | 2.2, 2.3, 2.4, 2.6 |
| ST-07 | `normative_decision_required` | `moderate` | `EXP` : six `1.2` sont refusés par l'API et acceptés/floorés localement. | Disponibilité et distribution différentes sur décimaux. | Définir type métier des samples. | 2.2, 2.3, 2.4, 2.6 |
| ST-08 | `equivalent_demonstrated` | `none` | `EXP` : fractions/négatifs/hors bornes pour objectifs et `n_sims` rejetés des deux côtés. | Aucun écart vérifié. | Corpus de limites. | 2.6, 2.8 |
| ST-09 | `normative_decision_required` | `moderate` | `EXP` : `-1` et `4294967296` rejetés backend, acceptés et renvoyés localement. | Replay ambigu malgré état PRNG ramené sur 32 bits. | Valider/encapsuler la seed. | 2.2, 2.4, 2.5, 2.6 |
| ST-10 | `observable_non_decisional` | `low` | `CODE` : backend `20000/false`, TS local exige `nSims` et défaut `true`; service envoie les deux. | Différence seulement pour appel direct observé. | Uniformiser ou documenter les défauts. | 2.2, 2.3 |
| ST-11 | `intentional_difference` | `low` | `CODE` : `secrets` serveur, Web Crypto/horloge navigateur; environnements distincts. | Seeds automatiques différentes attendues. | Injecter les sources variables sans choisir ici. | 2.5, 2.6 |
| ST-12 | `normative_decision_required` | `high` | `EXP` : seed 42, premiers indices Python `0,4,3...`; TS `3,2,5...`. | Aucune égalité bit-à-bit interlangage. | Décider le niveau de parité requis. | 2.2, 2.5, 2.6, 2.7 |
| ST-13 | `equivalent_demonstrated` | `none` | `EXP` : quatre seeds répétées, réponses strictement identiques dans chaque moteur. | Rejeu interne démontré. | Pérenniser dans 2.6/2.8. | 2.6, 2.8 |
| ST-14 | `observable_non_decisional` | `moderate` | `CODE/EXP` : tirage avec remplacement commun; moments proches et percentiles identiques sur 4 seeds, ordre différent. | Équivalence statistique observée, non prouvée universellement. | Définir tolérances distributionnelles. | 2.2, 2.5, 2.6 |
| ST-15 | `equivalent_demonstrated` | `none` | `EXP` : backlog 5/sample 5 → 1 semaine; backlog 6/sample 2 → 3; fin semaine 521 distincte. | Règle délai identique. | Ajouter au corpus. | 2.6, 2.8 |
| ST-16 | `equivalent_demonstrated` | `none` | `EXP` : tout-zéro → 1000 censures, distribution vide, percentiles vides. | Censure structurée identique. | Ajouter total/partiel/exact horizon. | 2.6, 2.8 |
| ST-17 | `potentially_decisional_divergence` | `critical` | `EXP` : 1 000 seeds, mêmes paramètres → P90 présent 290 fois en Python et 268 en TS; 398 paires diffèrent, dans les deux sens. Seed 123 n'est qu'un cas reproductible, pas une preuve de biais. | La disponibilité de P90 et le diagnostic sont sensibles à l'échantillonnage près du rang; aucun critère commun de stabilité n'existe. | Normer stabilité, censure et parité aléatoire avant tout alignement. | 2.2, 2.5, 2.6, 2.7, 2.8 |
| ST-18 | `equivalent_demonstrated` | `none` | `EXP` : sample constant 3 × 4 semaines → 12 dans 1000/1000. | Règle capacité identique. | Corpus déterministe. | 2.6, 2.8 |
| ST-19 | `equivalent_demonstrated` | `none` | `EXP` : tailles 1/2/3/5/10/20, P50..P100, doublons et ruptures identiques. | Aucun écart de délai hors censure. | Corpus partagé. | 2.6, 2.8 |
| ST-20 | `equivalent_demonstrated` | `none` | `EXP` : rang `ceil(p*total)` et omission si terminés insuffisants identiques. | Règle de censure équivalente. | Formaliser avant alignement PRNG. | 2.2, 2.6 |
| ST-21 | `equivalent_demonstrated` | `none` | `EXP` : mêmes cas donnent des P50≥P70≥P90 identiques. | Capacité prudente équivalente. | Corpus partagé. | 2.6, 2.8 |
| ST-22 | `normative_decision_required` | `low` | `CODE/EXP` : fonctions acceptent P80/P85/P100; DTO TS ne type que P50/P70/P90. | Extension future ambiguë. | Encapsuler l'ensemble autorisé. | 2.2, 2.3, 2.4 |
| ST-23 | `equivalent_demonstrated` | `none` | `EXP` : invariants backlog croissant et items décroissant tenus sur tous les cas. | Aucun écart vérifié. | Rendre bloquant après corpus. | 2.6, 2.8 |
| ST-24 | `potentially_decisional_divergence` | `high` | `CODE/EXP` : avec P50 présent et P90 absent, Python retourne `None`; TS convertit P90 absent en `0` par `?? 0`, puis retourne un score `0`. Sur les 1 000 seeds, score présent 290 fois en Python et 1 000 fois en TS. | Un score absent devient un score nul, susceptible d'être présenté comme faible malgré un P90 non identifiable. | Normer les prérequis du score et couvrir la garde P90 absente. | 2.2, 2.4, 2.6, 2.7, 2.8 |
| ST-25 | `observable_non_decisional` | `low` | `EXP` : `6/10` → backend `0.666666...`; réponse locale arrondie `0.6667`; UI/PDF recalculent. | Différence DTO visible; catégorie inchangée dans les cas vérifiés. | Fixer précision de wire et affichage. | 2.2, 2.3, 2.6 |
| ST-26 | `single_engine_by_design` | `none` | `CODE` : catégorisation seulement frontend, après réception/calcul du score. | Interprétation sans équivalent backend attendu. | La déclarer hors parité moteur. | 2.2, 2.4, 2.6 |
| ST-27 | `equivalent_demonstrated` | `none` | `EXP` : moyenne et écart-type population identiques sur constantes, stables, volatiles et tendances. | Aucun écart vérifié. | Corpus métrique. | 2.6, 2.8 |
| ST-28 | `equivalent_demonstrated` | `none` | `EXP` : Q25/médiane/Q75 linéaires et `iqr_ratio` identiques sur les cas. | Aucun écart vérifié. | Formaliser interpolation. | 2.2, 2.6 |
| ST-29 | `equivalent_demonstrated` | `none` | `EXP` : pentes arrondies identiques, y compris ±0.05, ±0.10, -0.15. | Valeur exposée identique. | Corpus de régression. | 2.6, 2.8 |
| ST-30 | `potentially_decisional_divergence` | `high` | `EXP` : `[16..24]` → Python `fiable`, TS `incertain`; `[12,14,..,28]` → `incertain`/`fragile`, malgré pentes exposées `0.05/0.1`. | Label et tonalité UI différents; diagnostic formel aval utilise la métrique arrondie et reste identique sur ces deux cas. | Normer comparaison/arrondi et aligner ensuite. | 2.2, 2.4, 2.6, 2.7, 2.8 |
| ST-31 | `not_comparable` | `moderate` | `EXP` : helper Python avec `NaN` propage NaN; helper TS filtre; l'API Python refuse cette entrée. | Aucun chemin production commun comparable. | Définir le prérequis du helper. | 2.2, 2.3, 2.4 |
| ST-32 | `equivalent_demonstrated` | `none` | `EXP` : 10 et exactement 100 valeurs distinctes restent des buckets exacts triés. | Aucun écart structurel. | Corpus exact. | 2.6, 2.8 |
| ST-33 | `observable_non_decisional` | `moderate` | `EXP` : 101 continues → Python 100 buckets, TS 51; plage discontinue → centres `50/9951` vs `51/10050`. | Courbe et histogramme visibles différents; percentiles bruts inchangés. | Choisir bornes, largeur et centre normatifs. | 2.2, 2.4, 2.6, 2.7 |
| ST-34 | `equivalent_demonstrated` | `none` | `EXP` : masse 20000 conservée, buckets vides omis, ordre croissant des deux côtés. | Aucun écart de masse. | Invariant bloquant futur. | 2.6, 2.8 |
| ST-35 | `single_engine_by_design` | `none` | `CODE/TEST` : courbe backlog utilise total terminés+censurés et plafonne au taux réel. | Restitution correcte sans équivalent Python attendu. | Formaliser comme règle de restitution. | 2.2, 2.6 |
| ST-36 | `single_engine_by_design` | `none` | `CODE/TEST` : probabilité « au moins » décroissante pour items. | Restitution frontend. | Corpus de présentation. | 2.2, 2.6 |
| ST-37 | `single_engine_by_design` | `moderate` | `CODE` : anciens percentiles ascendants recalculés depuis les buckets. | Histogramme agrégé legacy peut rendre le recalcul approximatif. | Séparer migration DTO et règle métier. | 2.2, 2.3, 2.6 |
| ST-38 | `equivalent_demonstrated` | `none` | `CODE/TEST` : une valeur réellement `undefined`/`None` est omise sur le wire; summary présent seulement backlog. ST-24 traite séparément le calcul local d'un score `0` quand P90 manque. | Mécanisme d'omission compatible; prérequis de calcul non équivalent. | Conserver l'omission dans le contrat consommateur. | 2.2, 2.3, 2.8 |
| ST-39 | `single_engine_by_design` | `none` | `CODE/TEST` : Mongo persiste percentiles, distribution, censure, fiabilité, seed; pas le score. | Historique serveur anonymisé distinct du local. | Clarifier DTO de persistance. | 2.3, 2.6 |
| ST-40 | `single_engine_by_design` | `none` | `CODE/TEST` : historique local garde contexte, résultat et seed, puis rejoue. | Responsabilité navigateur attendue. | Clarifier modèle métier/DTO. | 2.3, 2.5, 2.6 |
| ST-41 | `single_engine_by_design` | `high` | `CODE/TEST` : semaines lundi-dimanche complètes, zéros matérialisés, dates partielles écartées. | L'échantillon conditionne toute décision mais ne doit pas être porté au backend. | Exclure de la parité moteur, référencer les entrées. | 2.2, 2.6; Feature 8 pour qualité temporelle |
| ST-42 | `single_engine_by_design` | `high` | `EXP` : équipes constantes 10/5/2 donnent scénario indépendant 17. | Hypothèse de capacité portefeuille. | Formaliser la responsabilité, sans créer d'équivalent Python. | 2.2, 2.4, 2.6 |
| ST-43 | `single_engine_by_design` | `high` | `EXP` : 17 × 90 %, puis `floor` → 15. | Capacité affichée dépend de la convention de troncature. | Formaliser taux et arrondi. | 2.2, 2.4, 2.6 |
| ST-44 | `single_engine_by_design` | `high` | `EXP` : 3 équipes à 90 % → facteur 0.81, `floor(13.77)=13`. | Arbitrage sensible au nombre d'équipes. | Formaliser exposant, arrondi et domaine. | 2.2, 2.4, 2.6 |
| ST-45 | `single_engine_by_design` | `high` | `EXP` : semaines communes `[10+5, 0+2]` → `[15,2]`. | Scénario observé distinct du bootstrap. | Formaliser intersection et zéros. | 2.2, 2.4, 2.6 |
| ST-46 | `single_engine_by_design` | `high` | `CODE/TEST` : absence percentile → incertitude non mesurable; censures/dispersion dégradent la recommandation. | Décision aval explicite. | Déclarer ces règles métier hors moteur Python. | 2.2, 2.4, 2.6 |
| ST-47 | `single_engine_by_design` | `high` | `CODE/TEST` : écarts P90 de 10 %/25 % définissent modéré/élevé. | Choix de fenêtre et engagement. | Formaliser puis calibrer séparément. | 2.2, 2.4, 2.6; Feature 9 pour calibration |
| ST-48 | `single_engine_by_design` | `high` | `CODE/TEST` : diagnostic conclut preuves insuffisantes, scénario préféré `null`. | Évite une recommandation statistique non fondée. | Maintenir hors comparaison moteur. | 2.2, 2.6 |
| ST-49 | `not_comparable` | `none` | `CODE` : Cycle Time dérive des transitions de révisions et utilise des fenêtres glissantes. | Usage et unité différents du Monte Carlo. | Exclure explicitement du contrat de parité. | 2.2 |
| ST-50 | `single_engine_by_design` | `low` | `CODE/TEST` : moyenne pondérée visuelle 1-2-3-2-1, compte brut conservé. | Présentation seulement. | Documenter hors parité statistique. | 2.2, 2.6 |
| ST-51 | `single_engine_by_design` | `moderate` | `CODE/TEST` : UI/PDF recalculent score/fiabilité/probabilité depuis les données affichées. | Peut diverger d'un DTO sans modifier les percentiles. | Définir source d'autorité de restitution. | 2.2, 2.3, 2.6 |

## 7. Résultats expérimentaux

### Contrat et normalisation

| Cas | Python | TypeScript | Conclusion |
| --- | --- | --- | --- |
| défauts | accepte, `n_sims=20000`, zéros exclus | `nSims` requis; local zéros inclus par défaut | différence masquée par le service courant |
| six `1.0` | accepte et normalise en `1` | accepte | équivalent observable |
| six `1.2` | rejet `int_from_float` | accepte, puis `Math.floor` dans le moteur | décision normative requise |
| six `NaN` | rejet `finite_number` | rejet par historique utilisable insuffisant | rejet commun, cause/ordre différents |
| six chaînes `"1"` | accepte et coercit | rejette par filtre `Number.isFinite` | contrat divergent |
| champ supplémentaire | rejette `extra_forbidden` | validateur ignore | contrat divergent; payload produit reste whitelisté |
| seed -1 / 2^32 | rejette | moteur local accepte, normalise l'état mais renvoie la valeur originale | reproductibilité ambiguë |

### Simulation déterministe et censure

| Cas | Python | TypeScript | Conclusion |
| --- | --- | --- | --- |
| backlog 5, samples `[5×6]` | P50/P70/P90=1 | idem | équivalence démontrée |
| backlog 6, samples `[2×6]` | tous à 3 semaines | idem | équivalence démontrée |
| 4 semaines, samples `[3×6]` | tous à 12 items | idem | équivalence démontrée |
| zéros exclus, `[0,2×6]`, backlog 4 | tous à 2 semaines | idem | équivalence démontrée |
| zéros inclus, même cas | P50=2, P70=2, P90=3 | mêmes percentiles | distribution exacte différente, règle aval identique |
| tout zéro | 1000 censures, aucun percentile | idem | équivalence démontrée |
| censure partielle, backlog 430 | 692 terminées, seulement P50 | 718 terminées, P50/P70 | différence aléatoire près d'un rang |
| rang critique, backlog 424 | 887 terminées, P90 absent | 906 terminées, P90=521 | divergence potentiellement décisionnelle |

Analyse de sensibilité reproductible : throughput `[0,1,1,1,1,1]`, backlog 424, 1 000 simulations par
seed, seeds entières `0..999`.

| Mesure | Python — PCG64 | TypeScript — Mulberry32 |
| --- | ---: | ---: |
| P50 présent | 1 000/1 000 | 1 000/1 000 |
| P70 présent | 1 000/1 000 | 1 000/1 000 |
| P90 présent | 290/1 000 (29,0 %) | 268/1 000 (26,8 %) |
| censures min/max | 76 / 143 | 71 / 154 |
| censures moyenne/médiane | 105,794 / 106 | 106,609 / 106 |
| taux de censure min/max | 7,6 % / 14,3 % | 7,1 % / 15,4 % |
| taux moyen/médian | 10,5794 % / 10,6 % | 10,6609 % / 10,6 % |
| écart-type interne du taux | 0,9714 point | 0,9764 point |
| P90 présent, min/max | 520 / 521 | 520 / 521 |
| Risk Score présent | 290/1 000 | 1 000/1 000 |

Pour les paires portant le même entier de seed, P90 est présent dans les deux moteurs 80 fois, absent dans
les deux 522 fois, présent seulement en Python 210 fois et seulement en TypeScript 188 fois : 398/1 000
(39,8 %) de disponibilité divergente. Cette mise en paire décrit les chemins produit pour une même valeur
de seed; elle ne met pas en correspondance les tirages PCG64 et Mulberry32. Les deux directions sont
observées, les médianes sont identiques et l'écart des taux moyens de censure (0,0815 point) est petit devant
la variabilité interne d'environ 0,97 point. `EXP/INF` : aucun biais interlangage n'est démontré; le résultat
soutient une sensibilité au rang P90 liée à l'échantillonnage.

Une différence algorithmique distincte est confirmée : lorsque P50 est présent et P90 absent, la garde
Python retourne `None`, alors que TypeScript remplace P90 absent par `0` avant le calcul et renvoie un score
`0`. Elle explique les 1 000 scores TS contre 290 scores Python; ce n'est ni un effet du PRNG ni une simple
variation d'échantillonnage.

### Percentiles

Pour les distributions de tailles 1, 2, 3, 5, 10 et 20, avec doublons, valeurs éloignées et niveaux P50,
P70, P80, P85, P90 et P100, les dictionnaires Python et TypeScript sont identiques. Exemples :

- `[1,100]` backlog → tous les percentiles testés valent 100; items → tous valent 1;
- `[1,1,2,50,100]` backlog → `2,50,100,100,100,100`; items → `2,1,1,1,1,1`;
- les invariants `P50 <= P70 <= P90` et `P50 >= P70 >= P90` sont toujours tenus.

### Fiabilité

Les séries constante, stable, volatile, ascendante, descendante, de tailles 5/6/7/8 et de moyenne nulle
produisent les mêmes métriques arrondies et labels. Les seuils CV entiers construits exactement à 0.5, 1 et
1.5 produisent aussi les mêmes labels `incertain`, `fragile`, `non fiable`.

Deux frontières de pente sur historiques entiers divergent :

| Entrée | Python | TypeScript | Impact observé |
| --- | --- | --- | --- |
| `[16,17,18,19,20,21,22,23,24]` | brut `0.049999999999999954`, affiché `0.05`, `fiable` | brut `0.05`, affiché `0.05`, `incertain` | label/tonalité différents |
| `[12,14,16,18,20,22,24,26,28]` | brut `0.09999999999999998`, affiché `0.1`, `incertain` | brut `0.1`, affiché `0.1`, `fragile` | label/tonalité différents |
| séries descendantes équivalentes | labels identiques | labels identiques | asymétrie flottante non universelle |

`CODE/EXP` : les conventions mathématiques de comparaison sont équivalentes (`<` par états en Python,
`>=` par branches en TypeScript), mais NumPy `polyfit` et la régression explicite TS produisent des valeurs
brutes de côtés différents du seuil. Les labels comparent la valeur brute avant l'arrondi à quatre décimales;
l'origine confirmée est donc la précision flottante du calcul de pente, pas l'affichage arrondi. Le diagnostic
d'incertitude consomme ensuite la métrique arrondie et reste respectivement modéré ou élevé sur les deux
chemins; la divergence démontrée porte sur le label de fiabilité.

### Histogrammes

| Entrée (`target_weeks=1`, 20000 simulations) | Python | TypeScript | Masse |
| --- | --- | --- | ---: |
| 10 valeurs distinctes | 10 buckets exacts | 10 buckets exacts | 20000/20000 |
| exactement 100 | 100 exacts | 100 exacts | 20000/20000 |
| 101 continues `0..100` | 100 buckets, centres finaux jusqu'à 100 | 51 buckets, centres impairs jusqu'à 101 | 20000/20000 |
| `0..99` + `10000` | centres 50 et 9951 | centres 51 et 10050 | 20000/20000 |

### Seeds et distributions

Seeds testées : `0`, `1`, `42`, `4294967295`; 20000 simulations, samples `[1..6]`.

- reproductibilité Python avec lui-même : démontrée pour les quatre seeds;
- reproductibilité TypeScript avec lui-même : démontrée pour les quatre seeds;
- égalité exacte interlangage : absente dès les premiers indices;
- `weeks_to_items` : P50=28, P70=25, P90=22 sur les huit exécutions; moyennes Python
  `27.9741..28.0222`, TS `27.9893..28.03385`; écarts-types proches;
- `backlog_to_weeks` : P50=6, P70=7, P90=8, aucune censure sur les huit exécutions;
- `INF` : ces observations soutiennent une équivalence distributionnelle sur ce cas, sans la prouver pour
  toutes les distributions ni pour les rangs proches d'un seuil de censure.

### Portefeuille

Pour trois équipes constantes `[10,10]`, `[5,5]`, `[2,2]`, taux 90 %, seed 123 : Indépendant=17,
Arrimé=`floor(17×0.9)=15`, Friction=`floor(17×0.9²)=13`. Deux historiques alignés
`[10,0]` et `[5,2]` donnent l'historique corrélé `[15,2]`. Ces résultats caractérisent les règles
frontend-only; ils ne prouvent ni indépendance réelle, ni substituabilité, ni validité future.

## 8. Divergences potentiellement décisionnelles

### D-01 — disponibilité de P90 près du rang de censure

- `CODE` : les deux moteurs appliquent le même rang sur `n_sims`.
- `EXP` : entrée `[0,1,1,1,1,1]`, backlog 424, 1 000 simulations, seeds `0..999`.
- Python : taux de censure moyen 10,5794 %, P90 présent dans 29,0 % des exécutions.
- TypeScript : taux de censure moyen 10,6609 %, P90 présent dans 26,8 % des exécutions.
- Les disponibilités de P90 divergent pour 398 paires, avec 210 basculements Python seul et 188 TS seul.
- `EXP/INF` : les basculements sont fréquents et bidirectionnels; aucun biais interlangage n'est démontré.
  La conclusion retenue est **B — sensibilité au seuil de censure sans biais interlangage démontré**.
- Cause reformulée : sensibilité décisionnelle des percentiles censurés à l'échantillonnage aléatoire,
  combinée à l'absence de contrat commun sur le PRNG, les critères de stabilité et la restitution des
  percentiles manquants.
- Le cas seed 123 reste reproductible (887/113/P90 absent contre 906/94/P90=521), mais ne constitue pas à
  lui seul une preuve d'une distribution Python biaisée par rapport à TypeScript.
- statut `potentially_decisional_divergence`, sévérité `critical`, traitement 2.2/2.5/2.6/2.7/2.8.

### D-02 — Risk Score quand P90 est censuré

- `CODE` : Python exige P50 et P90; TypeScript convertit chaque percentile absent en `0`, puis ne garde que
  la condition P50 positive.
- `EXP` : sur les 1 000 seeds, le score est présent 290 fois en Python et 1 000 fois en TypeScript. Python
  l'omet dans ses 710 exécutions sans P90; TypeScript expose `0` dans ses 732 exécutions sans P90.
- `INF` : une absence d'information devient une dispersion nulle; l'affichage peut donc associer un score
  faible à un P90 non identifiable, même si le diagnostic des percentiles signale séparément l'incertitude.
- statut `potentially_decisional_divergence`, sévérité `high`, traitement 2.2/2.4/2.6/2.7/2.8.

### D-03 — labels de fiabilité aux seuils de pente

- `EXP` : historiques entiers `[16..24]` et `[12,14,..,28]`.
- Python : valeurs brutes `0.049999999999999954` et `0.09999999999999998`, affichées `0.05` et `0.1`;
  labels `fiable` puis `incertain`.
- TypeScript : valeurs brutes `0.05` et `0.1`, affichées identiquement; labels `incertain` puis `fragile`.
- `CODE/EXP` : les deux moteurs comparent la valeur brute selon des conventions mathématiquement
  équivalentes. La divergence provient de la précision flottante des deux calculs de régression avant arrondi.
- `INF` : la tonalité et le libellé utilisateur changent; le diagnostic aval basé sur la pente arrondie est
  identique sur ces cas, donc aucune décision finale différente n'a été démontrée.
- statut `potentially_decisional_divergence`, sévérité `high`, traitement 2.2/2.4/2.6/2.7/2.8.

## 9. Différences intentionnelles

La seule ligne classée `intentional_difference` est la génération automatique de seed : serveur et
navigateur disposent de sources cryptographiques/horloge différentes et n'exécutent pas le même contexte.
Cette différence ne justifie pas à elle seule des résultats métier différents une fois une seed explicite
fournie; le niveau de parité d'une seed explicite reste une décision normative.

Les responsabilités frontend-only ne sont pas placées ici : elles sont classées `single_engine_by_design`
afin de distinguer « responsabilité unique » de « deux implémentations volontairement différentes ».

## 10. Responsabilités mono-moteur

### Légitimes par conception

- collecte ADO et construction des semaines complètes, imposées par la frontière d'identité navigateur;
- génération cryptographique serveur, rate limiting, timeout et persistance Mongo;
- historique local contextualisé et historique serveur anonyme;
- courbes de probabilité, lissage, UI et rapports;
- préparation des scénarios portefeuille et diagnostic comparatif.

### À réexaminer normativement

- catégorisation du Risk Score et seuils de diagnostic;
- recalcul legacy des percentiles depuis un histogramme potentiellement agrégé;
- source d'autorité du score et de la fiabilité dans UI/PDF;
- troncatures Arrimé/Friction, même si aucun équivalent backend n'est attendu.

### Non comparables

- Cycle Time, car il mesure un délai entre transitions d'état et non une projection bootstrap;
- helper de fiabilité appelé directement avec des non-finis, car le chemin API Python refuse l'entrée avant
  ce helper alors que le helper TS filtre.

## 11. Lacunes de tests

- aucun test partagé n'exécute la même entrée contre Python et TypeScript;
- aucun test ne protège la frontière de censure où P90 apparaît/disparaît selon le PRNG;
- aucun test du moteur local ne couvre P50 présent avec P90 absent; la garde actuelle produit un score nul;
- aucun test de parité ne couvre les seuils de pente 0.05 et 0.10 avec historiques entiers;
- les tests d'histogramme vérifient surtout masse et maximum, pas égalité des bornes/centres;
- aucune preuve statistique formelle ne borne les écarts de distribution entre PRNG;
- pas de test consommateur-producteur partagé sur coercions, extras, non-finis et seeds hors domaine;
- pas de corpus commun P50/P70/P80/P85/P90/P100 versionné — volontairement non créé ici;
- pas de gate bloquante — volontairement non créée ici.

## 12. Lacunes de contrat

- niveau de parité aléatoire non défini;
- coercions numériques, décimaux et non-finis non définis en commun;
- domaine de seed non appliqué au moteur local;
- défauts et champs inactifs/supplémentaires non définis en commun;
- précision du Risk Score et ordre « calcul → arrondi → seuil » non définis;
- prérequis de présence de P90 pour calculer et restituer le Risk Score non défini en commun;
- convention d'histogramme agrégé non définie;
- ensemble extensible des percentiles non représenté par le DTO TS;
- frontières entre DTO API, modèle statistique, historique local et persistance serveur implicites.

## 13. Décisions normatives nécessaires

Le PBI 2.2 doit répondre au minimum aux questions suivantes :

1. Une seed identique doit-elle garantir l'égalité exacte Python/TS, ou seulement la reproductibilité interne ?
2. Si l'égalité exacte n'est pas requise, quelles tolérances distributionnelles et décisionnelles sont
   acceptables, en particulier aux rangs censurés ?
3. En cas de P90 censuré, le Risk Score doit-il être absent, nul ou explicitement non mesurable ?
4. Le label de fiabilité compare-t-il les métriques non arrondies, arrondies à quatre décimales, ou avec une
   tolérance explicite ?
5. Les samples doivent-ils être des entiers stricts; les chaînes, décimaux et non-finis sont-ils rejetés ou
   normalisés ?
6. Quel domaine de seed et quel comportement de dépassement s'appliquent à tous les chemins ?
7. Quels défauts et quelle politique de champs supplémentaires/inactifs font foi ?
8. Quel algorithme d'histogramme définit largeur, bornes, rattachement et centre ?
9. Quelle précision de score appartient au modèle, au wire et à l'affichage ?
10. Quelles responsabilités frontend-only sont explicitement hors contrat de parité moteur ?

## 14. Répartition vers les PBI 2.2 à 2.8

| PBI | Résultats à recevoir |
| --- | --- |
| **2.2** | Toutes les décisions ci-dessus; stabilité aléatoire, règles de censure, score sans P90, seuils, histogrammes, défauts et périmètre mono-moteur. |
| **2.3** | Différences DTO/API/historiques, extras, null/omis, percentiles typés et transformations de persistance. |
| **2.4** | Seed, collection de percentiles, métriques de fiabilité, completion summary et paramètres de scénarios à encapsuler. |
| **2.5** | PCG64/Mulberry32, seed automatique, horloge et identifiants locaux variables. |
| **2.6** | Cas déterministes, rang P90 censuré, score sans P90, seuils de pente, tailles de percentile, histogrammes 100/101 et seeds. |
| **2.7** | Seulement après 2.2 : contrat d'entrée, seed/PRNG si décidé, garde du score, seuils de fiabilité et histogrammes. |
| **2.8** | Invariants, corpus 2.6 et régressions de parité après alignement, jamais pendant cet audit. |

La qualité temporelle ADO reste aussi orientée vers la Feature 8 et la calibration empirique vers la
Feature 9, car les confondre avec un alignement Python/TypeScript serait une comparaison invalide.

## 15. Risques et limites de l'audit

- `INCONNU` : aucune observation d'une décision utilisateur réelle ne quantifie l'effet des divergences.
- L'expérience générale couvre quatre seeds; la sensibilité ciblée à la censure couvre 1 000 seeds mais un
  seul historique, un backlog et `n_sims=1000`. Elle ne démontre pas une équivalence statistique universelle.
- Les seeds numériques identiques ne couplent pas les tirages PCG64 et Mulberry32; les comparaisons par seed
  décrivent les sorties produit, pas des paires de trajectoires aléatoires homologues.
- Le cas de censure est volontairement proche d'un rang; il prouve une divergence observable, pas que l'un
  des PRNG est incorrect.
- Les entrées décimales/non-finies ne proviennent pas du collecteur ADO courant; leur impact produit reste
  potentiel tant que le contrat n'en fait pas un usage supporté.
- Aucun service ADO ou Mongo réel n'a été sollicité; les chemins sont établis par code et tests existants.
- La validation normative complète du profil `main`, E2E, couvertures et Docker compris, a été exécutée à
  la clôture du PBI et est verte; elle prouve la conformité du dépôt, pas la justesse normative des choix
  statistiques reportés aux PBI 2.2 à 2.8.
- Les scripts `.tmp/` sont temporaires, non normatifs et non destinés au versionnement.

## 16. Commandes exécutées

### Cadrage et inventaire

Objectif : lire les huit documents prioritaires. Résultat : succès pour chaque commande.

```powershell
Get-Content -Raw docs/backlog.md
Get-Content -Raw PRODUCT.md
Get-Content -Raw ARCHITECTURE.md
Get-Content -Raw README.md
Get-Content -Raw CHANGELOG.md
Get-Content -Raw docs/risk-control-matrix.md
Get-Content -Raw docs/critical-paths.md
Get-Content -Raw docs/definition-of-done.md
```

Objectif : sécurité de publication en lecture seule. Résultats : worktree initial propre, branche `main`,
remote GitHub `origin` présent.

```powershell
git status --short
git branch --show-current
git remote -v
```

Objectif : recherche transversale du cadrage et des responsabilités. Résultat : succès.

```powershell
rg -n -i -C 3 "statist|python|typescript|simulate|simulation|percentile|throughput|risk score|seed|aléatoire|aleatoire|parité|parite" PRODUCT.md ARCHITECTURE.md README.md CHANGELOG.md docs/risk-control-matrix.md docs/critical-paths.md
rg -n -i "percentile|quantile|median|médiane|quartile|iqr|variance|std|écart|slope|regression|régression|mean|moyenne|risk.?score|histogram|bucket|censor|seed|random|Math\.(floor|ceil|round)|np\.(floor|ceil|round)|correl|friction|throughput|backlog|n_sims" backend frontend/src
```

Les lectures de source ont ensuite utilisé `Get-Content -Encoding UTF8 <chemin>` et `rg -n "^"
<chemin>` sur les fichiers et tests recensés en section 5; toutes ont réussi.

### Expériences temporaires

Objectif : vérifier puis compiler les runners. Le premier `py_compile` a signalé une erreur de syntaxe dans
le script temporaire, corrigée sans toucher au produit; la seconde exécution et les deux compilations TS ont
réussi.

```powershell
python -m py_compile .tmp/statistical-parity-python.py
node frontend/node_modules/typescript/bin/tsc --module commonjs --moduleResolution node --target ES2022 --outDir .tmp/stat-audit-ts --rootDir . --esModuleInterop --skipLibCheck .tmp/statistical-parity-typescript.ts frontend/src/utils/simulation.ts frontend/src/simulationLimits.ts frontend/src/types.ts frontend/src/utils/math.ts
node frontend/node_modules/typescript/bin/tsc --module commonjs --moduleResolution node --target ES2022 --outDir .tmp/stat-audit-boundaries --rootDir . --esModuleInterop --skipLibCheck .tmp/statistical-boundaries-typescript.ts frontend/src/utils/simulation.ts frontend/src/simulationLimits.ts frontend/src/types.ts frontend/src/utils/math.ts
```

Objectif : exécuter les comparaisons principales. Résultat : la première commande a échoué car le Python
système n'avait pas NumPy; les commandes utilisant `.venv` et Node ont réussi.

```powershell
python .tmp/statistical-parity-python.py
& .\.venv\Scripts\python.exe .tmp/statistical-parity-python.py
node .tmp/stat-audit-ts/.tmp/statistical-parity-typescript.js
& .\.venv\Scripts\python.exe .tmp/statistical-boundaries-python.py
node .tmp/stat-audit-boundaries/.tmp/statistical-boundaries-typescript.js
```

Objectif : localiser le rang P90 où les deux séquences passent de côtés différents. Résultat : backlog 424.

```powershell
& .\.venv\Scripts\python.exe -c "import numpy as np; from backend.mc_core import mc_finish_weeks; s=np.array([0,1,1,1,1,1]); print([(b,mc_finish_weeks(b,s,n_sims=1000,include_zero_weeks=True,seed=123).completed_count) for b in range(410,431)])"
node -e "const {simulateMonteCarloLocal:s}=require('./.tmp/stat-audit-ts/frontend/src/utils/simulation.js'); console.log(Array.from({length:21},(_,i)=>{const b=410+i;const r=s({throughputSamples:[0,1,1,1,1,1],includeZeroWeeks:true,mode:'backlog_to_weeks',backlogSize:b,nSims:1000,seed:123});return [b,r.completion_summary.completed_count]}))"
```

Objectif : mesurer la sensibilité au rang censuré sur les seeds `0..999` et exposer les valeurs brutes des
frontières de pente. Résultat : le premier essai de compilation a rencontré l'erreur sandbox esbuild connue;
la même compilation et exécution hors sandbox a réussi. P90 est présent 290 fois en Python et 268 fois en
TypeScript; 398 paires de disponibilité divergent dans les deux sens. Les métriques détaillées sont en
section 7.

```powershell
& .\frontend\node_modules\.bin\esbuild.cmd .tmp/statistical-sensitivity-typescript.ts --bundle --platform=node --format=cjs --outfile=.tmp/statistical-sensitivity-typescript.cjs
node .\.tmp\statistical-sensitivity-typescript.cjs
```

### Tests ciblés et contrôles documentaires

Objectif : moteur, API et persistance statistique Python. Résultat : 117 réussis.

```powershell
& .\.venv\Scripts\python.exe -m pytest tests/test_mc_core.py tests/test_api_simulate.py tests/test_api_history.py tests/test_simulation_store.py -q
```

Objectif : moteur local, contrat, chemins, portefeuille et diagnostics. Résultat : échec sandbox esbuild
documenté, puis 190 réussis avec la même commande hors sandbox.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' --prefix frontend run test:unit -- src/utils/simulation.test.ts src/hooks/Simulationforecastservice.test.tsx src/hooks/usePortfolioReport.test.tsx src/hooks/probability.test.ts src/hooks/useSimulationChartData.test.tsx src/api.test.ts src/apiHelpers.test.ts src/utils/forecastDiagnostics.test.ts src/utils/portfolioComparisonDiagnostic.test.ts src/adoClient.test.ts src/date.test.ts
```

Objectif : restitution UI/PDF et historique local. Résultat : 145 réussis hors sandbox.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' --prefix frontend run test:unit -- src/components/steps/SimulationResultsPanel.test.tsx src/components/steps/simulationPrintReport.test.ts src/components/steps/portfolioPrintReport.test.ts src/components/steps/simulationExportModules.test.ts src/hooks/useSimulationHistory.test.tsx
```

Objectif : contrôles documentaires affectés. Résultat : 43 réussis, puis `git diff --check` vert et aucune
fin de ligne contenant des espaces.

```powershell
& .\.venv\Scripts\python.exe -m pytest tests/test_repo_compliance.py tests/test_pre_commit_guard.py tests/test_maintainability.py -q
git diff --check
rg -n "[ \t]+$" docs/statistical-parity-audit.md CHANGELOG.md docs/backlog.md docs/risk-control-matrix.md
```

Objectif : recompter la matrice. Résultat : 51 lignes et comptes identiques au résumé.

```powershell
node -e "const fs=require('fs');const s=fs.readFileSync('docs/statistical-parity-audit.md','utf8');const rows=[...s.matchAll(/^\| ST-\d+ \| \x60([^\x60]+)\x60 \| \x60([^\x60]+)\x60 \|/gm)];const count=a=>Object.fromEntries([...new Set(a)].sort().map(x=>[x,a.filter(y=>y===x).length]));console.log(JSON.stringify({rows:rows.length,status:count(rows.map(r=>r[1])),severity:count(rows.map(r=>r[2]))},null,2))"
```

### Contrôles de clôture et validation normative

Objectif : rejouer uniquement le moteur et l'API Python concernés. Résultat : 88 réussis, 0 échec, 0
ignoré.

```powershell
& .\.venv\Scripts\python.exe -m pytest tests/test_mc_core.py tests/test_api_simulate.py -q
```

Objectif : rejouer le moteur local, le service et le contrat TypeScript. Résultat : l'essai sandbox a échoué
avant collecte sur l'erreur esbuild connue; la même commande hors sandbox a produit 95 réussis, 0 échec,
0 ignoré.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' --prefix frontend run test:unit -- src/utils/simulation.test.ts src/hooks/Simulationforecastservice.test.tsx src/api.test.ts src/apiHelpers.test.ts
```

Objectif : vérifier les documents affectés. Résultat : 43 réussis, aucun mojibake, aucun lien interne cassé,
51 lignes avec comptes cohérents, aucune espace terminale et `git diff --check` vert.

```powershell
& .\.venv\Scripts\python.exe -m pytest tests/test_repo_compliance.py tests/test_pre_commit_guard.py tests/test_maintainability.py -q
node -e "const fs=require('fs');const files=['docs/statistical-parity-audit.md','docs/backlog.md','docs/risk-control-matrix.md','CHANGELOG.md'];const bad=[String.fromCharCode(195),String.fromCharCode(194),String.fromCharCode(65533),String.fromCharCode(226,8364)];const hits=files.filter(f=>bad.some(x=>fs.readFileSync(f,'utf8').includes(x)));console.log(hits);if(hits.length)process.exit(1)"
git diff --check
rg -n "[ \t]+$" docs/statistical-parity-audit.md docs/backlog.md docs/risk-control-matrix.md CHANGELOG.md
```

Objectif : exécuter sans substitution le DAG normatif complet du profil `main`. Résultat global :
`Quality gate passed`, 1 238 instances exécutées et réussies, 0 échec, 0 erreur d'infrastructure, 0 skip,
0 todo et 0 retry. Tous les nœuds ont un code 0 : `preflight` 9,307 s; `backend-static` 0,115 s;
`frontend-static` 37,321 s; `backend-tests` 72,559 s; `frontend-tests` 121,05 s; `e2e` 50,745 s;
`release-or-container-checks` 56,332 s; `aggregate` et reporting 132,1 s. Docker build, start, health,
persistance Mongo, rate-limit partagé, smoke et cleanup ont réussi.

```powershell
& .\.venv\Scripts\python.exe Scripts/quality_gate.py ci --profile main
```

## 17. Conclusion

`CODE/EXP` : les deux moteurs partagent les règles déterministes essentielles, mais ne partagent ni PRNG ni
contrat normatif complet. L'analyse multi-seeds ne démontre pas de biais interlangage sur le cas censuré;
elle démontre une sensibilité décisionnelle fréquente autour du rang P90. Trois responsabilités peuvent
changer un percentile, un score ou un label pour une même entrée : rang censuré, score sans P90 et seuils
flottants. Elles sont prouvées, qualifiées et routées, sans préjuger du comportement qui devra faire foi.

Les **452 tests ciblés** de l'audit initial sont verts. La clôture ajoute 226 contrôles ciblés réussis
(88 Python, 95 TypeScript, 43 documentaires), sans échec ni test ignoré, puis une validation normative
`main` entièrement verte avec 1 238 instances réussies. Le risque `RISK-003` reste partiellement couvert :
l'audit le caractérise, mais ne le corrige pas et aucune norme de parité n'est encore adoptée.

- **Implémenté :** audit versionné, sans correction des moteurs.
- **Validé :** oui; expériences, tests ciblés, contrôles documentaires et validation normative complète sont verts.
- **DoD compliant :** oui; `Validation : profil main` est entièrement verte, Docker compris.
- **Publishable : non**
- **Livré : non**
- **Inconnu :** norme cible, équivalence statistique universelle et impact réel sur des décisions utilisateurs.
