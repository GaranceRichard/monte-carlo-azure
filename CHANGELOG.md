# Changelog

## Recent

### Autorité des dépendances lisible et diagnostiquable — PBI 7.10

- publication d’un manifeste JSON fermé et versionné projetant les décisions normatives 7.7/7.8, avec six
  couches, matrice complète de 36 directions, trois runtimes et frontières cibles frontend, backend et
  qualité ;
- ajout d’un schéma Draft 2020-12, d’un parseur UTF-8 et de validations structurelles et sémantiques couvrant
  versions, sources et empreintes normatives, références, complétude, propriétaires et chemins ;
- diagnostics déterministes localisés par pointeur JSON ou ligne/colonne, accompagnés d’un code stable et
  d’une correction attendue, plus preuve de validation régénérable et tests positifs/négatifs ;
- livraison sans inspection des imports, familles de règles 7.11–7.16, intégration aux gates, migration du
  code produit ni modification des garanties statistiques.

### Architecture cible et frontières acceptées — PBI 7.8

- publication d’une architecture cible unique séparant domaine delivery et simulation, application, ports,
  adaptateurs, présentations, composition et infrastructure qualité dans les runtimes TypeScript et Python ;
- attribution des frontières physiques, responsabilités, ports entrants et sortants, composition roots,
  contrats frontend/backend et protocoles publics de preuve, avec propriétaires cibles des 23 données
  structurantes ;
- revue des trois scénarios de coût de changement contre des chaînes cibles localisées et des contrats de
  convergence permettant des chantiers frontend, backend, adaptateurs, restitutions et qualité indépendants ;
- décision publiée sans migration, implémentation de port ni refonte fonctionnelle, dans le respect strict des
  directions acceptées et avec toutes les garanties statistiques existantes inchangées.

### Directions de dépendance cibles décidées — PBI 7.7

- publication d’une décision normative couvrant domaine, application, ports, adaptateurs, présentation et
  composition, avec une matrice complète des relations permises et interdites ;
- confrontation de la cible aux deux cycles, aux deux contournements conventionnels, aux arêtes
  qualité-produit du graphe réel et aux ambiguïtés du registre des 23 autorités structurantes ;
- qualification explicite des imports de type, DTO techniques, protocoles interprocessus, composition roots,
  scripts opératoires et implémentations statistiques Python/TypeScript, avec exemples conformes et non
  conformes ;
- décision publiée sans migration, définition détaillée de port ni refonte fonctionnelle, et maintien strict
  des garanties statistiques existantes.

### Autorités des données structurantes explicites — PBI 7.6

- publication d'un registre vérifié de 23 familles de données structurantes avec, pour chacune, une autorité
  actuelle unique, ses producteurs et consommateurs exécutés et sa transformation de frontière ;
- confrontation des autorités aux modèles, imports, routes HTTP, stockages navigateur et MongoDB, moteurs et
  flux de restitution recensés par les cartes frontend 7.1 et backend 7.2 ;
- conservation explicite des alias, miroirs DTO, validations recouvrantes, politiques de rétention et autres
  définitions concurrentes observées, sans migration, refactoring ni décision d'architecture cible ;
- maintien strict du standard, des contrats et des garanties statistiques existants.

### Réalisation progressive des PBI d’une Feature ouverte

- alignement du contrôle d’atomicité sur l’autorité `Réalisé le` : une Feature conforme peut désormais être
  réalisée progressivement, tandis qu’une Feature encore à raffiner reste non engageable ;
- maintien de la précédence au niveau de la réalisation : un PBI daté est refusé si l’un de ses prédécesseurs
  déclarés ne l’est pas encore, en complément des contrôles d’existence, d’ordre et d’acyclicité ;
- datation des PBI 7.1 à 7.4 au 13/08/2026 et régénération des synthèses depuis l’autorité existante ;
- rattachement des attendus 7.1, 7.3 et 7.4 à leurs preuves livrées, et ajout de la carte backend à l’inventaire
  documentaire exhaustif.

### Responsabilités backend et cycle de vie des données cartographiés — PBI 7.2

- publication d'une carte vérifiable depuis les entrées FastAPI jusqu'aux commandes et résultats de domaine,
  au service, aux moteurs Monte Carlo, au PRNG, aux agrégats et aux DTO de sortie ;
- attribution de chaque transition du chemin `POST /simulate`, de la lecture d'historique et des routes de
  santé à leurs appels et imports réels, avec chemins d'échec et sorties visibles ;
- description du rate limit mémoire/Redis, de la persistance Mongo, de la rétention TTL, de la purge et du
  scrub d'identité, y compris les accès directs et chemins opératoires hors `SimulationStore` ;
- inventaire factuel des responsabilités ambiguës, validations recouvrantes et couplages observés, sans
  refactoring ni modification des comportements et garanties statistiques.

### Enforcement statistique complet du profil `main` — PBI 2.21

- ajout d’une politique fermée et versionnée qui associe les statuts statistiques aux décisions bloquantes,
  informatives, non applicables ou interdites, sans modifier les règles ni les seuils de `STD-STAT-001` ;
- intégration explicite des neuf contrôles obligatoires dans un sous-DAG : autorités, corpus et sondes,
  parités déterministe, exacte, de batching et distributionnelle, compatibilité, consolidation et validation
  indépendante, chaque preuve étant calculée une fois puis partagée ;
- attestation déterministe des empreintes de sources, contrats, preuves, dépendances et snapshot contrôlé, avec
  rejet des artefacts absents, périmés, mélangés entre snapshots ou issus d’un chemin hors du snapshot ;
- exécution locale complète depuis un snapshot isolé, avec une unique exposition des dépendances frontend et
  nettoyage après succès, échec ou interruption ;
- alignement du workflow GitHub Actions sur le même plan d’autorité et le SHA publié, avec agrégation rouge
  si un contrôle obligatoire échoue ou est sauté hors du profil `pr` ;
- mutations de l’ensemble des statuts bloquants, des dépendances du DAG, de la fraîcheur, du nettoyage et de
  l’absence de contournement silencieux, sans changement des autres profils légers.

### Gouvernance bloquante des dérives statistiques — PBI 2.20

- ajout d’une autorité JSON fermée couvrant 23 surfaces dans 15 composants versionnés, avec dépendances,
  consommateurs, preuves obligatoires et sept catégories de données historiques ou de cache
- extraction sémantique déterministe des autorités Python, TypeScript, Markdown normatif et JSON, sans faux
  positif sur commentaires ou descriptions, avec refus des autorités absentes, ambiguës ou illisibles
- contrôle direct bloquant des versions, décisions append-only, identités PRNG, preuves régénérées et choix
  de migration, lecture legacy, invalidation, purge, archivage ou rejet, sans migration de donnée réelle
- publication d’une preuve canonique `1.0` consommée comme onzième source et sixième niveau du rapport
  consolidé, sans ajout du contrôle au profil `main`
- mutations contrôlées des règles, moteurs, tirages, résultats, contrats, preuves et traitements historiques,
  avec diagnostics ciblés et protection contre les mises à jour coordonnées servant de faux oracle

### Rapport consolidé de conformité statistique — PBI 2.19

- publication d’un JSON canonique fermé `1.0` et d’une synthèse Markdown issus du même modèle, avec dix
  sources versionnées, leurs SHA-256, leurs validations et les empreintes canoniques disponibles
- consolidation sans rejeu opportuniste des conformités normative et algorithmique, des 22 sondes, du
  rejeu exact, de l’indépendance des quatre géométries de batching et des 49 métriques distributionnelles
- priorité déterministe des verdicts, diagnostics spécialisés exhaustifs et séparation stricte entre
  divergence normative, interlangage ou distributionnelle, résultat non concluant, incompatibilité,
  erreur moteur, protocole, infrastructure et preuve invalide
- génération byte-stable sans chemin absolu ni horodatage variable ; verdict courant `match`, 10 sources
  valides, 5 niveaux conformes, 16 cas, 22 sondes, 5 scénarios, 49 métriques et 0 diagnostic
- enforcement maintenu `informational` ; aucune décision de compatibilité future ni intégration bloquante
  au profil `main`, qui restent respectivement dans les PBI 2.20 et 2.21

### Protocole de parité distributionnelle versionné et testable — PBI 2.18

- ajout d’un protocole JSON fermé `1.0`, de son schéma, d’une population SHA-256 reproductible de 256 seeds
  en deux cohorts disjointes et de cinq scénarios issus des entrées du corpus `1.0`, sans lire leurs
  résultats exacts ni coupler les seeds entre moteurs
- comparaison symétrique de 49 métriques : CDF discrètes et histogrammes restitués, taux de complétion et
  de censure, présence et valeurs conditionnelles de P50/P70/P90 et du Risk Score, plus invariants exacts de
  fiabilité et de censure totale
- décision par bandes DKW, intervalles Newcombe–Wilson, permutations de blocs, Bonferroni simultané et
  Holm–Bonferroni ; résultats `match`, `divergence`, `inconclusive` et `invalid` distincts, sans succès
  implicite lorsque la puissance ou les observations conditionnelles sont insuffisantes
- calibration déterministe sur 200 répétitions, 12 designs, trois lois nulles et quatre écarts contrôlés :
  0 famille faussement positive sur 200, enveloppe binomiale 99 % à 18 et puissance observée de `1,00` au
  design de production, avec artefact byte-stable
- ajout des validateurs indépendants du protocole, de la calibration et de la preuve, du runner Python/Node
  et des preuves `reports/statistical-distribution-calibration.json` et
  `reports/statistical-distribution-evidence.json` ; verdict courant `match` sur 5 scénarios et 49 métriques
- contrôle maintenu informatif et séparé du backtesting, du rapport consolidé, de la gouvernance de
  compatibilité et de l’intégration bloquante au profil `main`; invalidité, moteur ou infrastructure en
  erreur conservent un code non nul

### Rejeu exact interlangage sur le corpus versionné — PBI 2.17

- ajout de la commande dédiée
  `.venv\Scripts\python.exe Scripts/run_statistical_exact_replay.py`, qui valide indépendamment le schéma,
  le corpus `1.0` et ses invariants avant d’appeler les runners Python et TypeScript
- rejeu des seize cas dans TypeScript et dans Python avec les batches backend `125`, `128`, `1000` et
  `2048`, couvrant respectivement `8 × 125`, `7 × 128 + 104`, un lot exactement égal à la population et
  un lot supérieur à la population
- comparaison directe de chaque sortie à l’autorité `expected_result` du corpus, puis comparaison
  interlangage, avec présence des champs, types primitifs JSON, valeurs et ordre des distributions exacts,
  sans tolérance, arrondi, tri correctif ni normalisation silencieuse
- publication de `reports/statistical-exact-replay-evidence.json` : 16 cas, 64 exécutions Python,
  16 exécutions TypeScript, 80 comparaisons normatives conformes, 64 comparaisons interlangages conformes,
  16 preuves d’indépendance du batching et aucun diagnostic
- diagnostics déterministes portant le cas, le moteur, la taille de batch, le chemin JSON, les états
  attendu et obtenu, ainsi que la classification `engine_error`, `normative_divergence` ou
  `interlanguage_divergence`
- contrôle maintenu informatif et explicitement distinct de l’équivalence distributionnelle, non évaluée ;
  corpus ou configuration invalide et moteur inexécutable restent des échecs non nuls, sans anticiper la
  consolidation du PBI 2.18, la gate du PBI 2.19 ni la gouvernance du PBI 2.20

### Construction normative des histogrammes — PBI 2.16

- remplacement des deux constructions historiques par une autorité de domaine par langage, conservant
  l’histogramme exact jusqu’à 100 valeurs distinctes puis appliquant la largeur entière, la borne droite
  inclusive tronquée et le représentant par plancher de `STD-STAT-001`
- suppression de `numpy.histogram` et des centres flottants arrondis côté Python, ainsi que de
  `Math.round(left + width / 2)` sans borne droite réelle côté TypeScript ; aucun recalcul de présentation
  n’est introduit
- renforcement du validateur autonome par un rejeu scalaire `mca-prng-v1` et une reconstruction indépendante
  des représentants et effectifs, sans moteur oracle
- preuves exactes, continues, discontinues, extrêmes et fortement asymétriques dans les deux langages ;
  `0..100` produit 51 représentants pairs et `0..99 + 10000` produit `50/9999`, avec masse et ordre exacts
- régénération du rapport à 16 cas conformes, aucune divergence normative ou inter-moteurs ; enforcement
  toujours informatif jusqu’au PBI 2.19
- anciennes sorties agrégées invalidées comme références courantes mais laissées lisibles dans les
  historiques, sans migration, changement de DTO, API, MongoDB, `localStorage`, seed, tirage, batching,
  percentile, censure, Risk Score, fiabilité ou version de contrat

### Métriques et labels de fiabilité du throughput — PBI 2.15

- centralisation du calcul de fiabilité dans un calculateur de domaine et un Value Object par langage, sans
  calcul concurrent dans `mc_core.py` ou `utils/simulation.ts`
- alignement explicite sur moyenne, variance et écart-type de population, quartiles à interpolation
  linéaire et pente déterministe des moindres carrés ; suppression de `numpy.percentile` et `numpy.polyfit`
- normalisation `round half up` à quatre décimales avant les seuils et application stricte de l’ordre
  `non fiable`, `fragile`, `incertain`, `fiable`, avec dégradation des historiques fiables de six ou sept
  observations
- ajout au corpus d’un seizième cas à sept observations dérivé de `STD-STAT-001` et `mca-prng-v1` sans
  moteur oracle, avec invariants de périmètre et tests exacts dans les deux langages
- résorption par des tests métier des branches invalides de Risk Score, mode et population qui laissaient
  rouges `simulationMappers.ts:56` et `simulation.ts:100,112`
- rapport à 14 cas conformes et deux seules divergences d’histogrammes agrégés ; construction des
  histogrammes, rejeu exact et enforcement informatif inchangés avant les PBI 2.16, 2.17 et 2.19

### Censures, percentiles et Risk Score — PBI 2.14

- suppression des durées sentinelles de censure dans les deux moteurs : seules les simulations terminées
  conservent une semaine, avec population totale et horizon explicites ; une fin exacte en semaine `521`
  reste une fin
- alignement de P50/P70/P90 sur les rangs `ceil(p × n_sims / 100)` en `backlog_to_weeks` et sur les
  quantiles de survie discrets en `weeks_to_items`, sans percentile supplémentaire ni fallback implicite
- autorité unique du Risk Score dans `SimulationPercentiles`, formule par mode et arrondi rationnel
  `round half up` à quatre décimales identiques en Python et TypeScript
- validation de la présence et de la valeur du score aux frontières ; API, MongoDB, historique, interface,
  portefeuille et PDF propagent désormais l’autorité sans recalcul
- suppression de la reconstruction des percentiles absents depuis l’histogramme, y compris pour les
  historiques legacy ; une absence de percentile ou de score reste strictement absente
- ajout du périmètre de preuve 2.14 au validateur du corpus et de tests discriminants dans les deux langages ;
  le rapport reste à 13 cas conformes et deux divergences d’histogrammes connues
- aucune modification des métriques ou labels de fiabilité du PBI 2.15, de la construction des histogrammes
  du PBI 2.16 ni de l’enforcement informatif avant le PBI 2.19

### Validation normalisée et forme des résultats — PBI 2.13

- alignement Python/TypeScript des types stricts, bornes, entiers, valeurs finies, négatifs, traitement des
  zéros et minimum de six observations utilisables
- validation fermée de la seed `uint32`, des champs inconnus et de la présence exclusive du paramètre actif,
  avec valeurs par défaut de transport communes (`include_zero_weeks = false`, `n_sims = 20000`)
- forme canonique de réponse fermée, champs obligatoires typés et omission stricte du Risk Score ou de la
  complétion indisponibles, sans `0`, `null`, `NaN`, chaîne vide ni autre sentinelle
- maintien de DTO, API, MongoDB et `localStorage` comme frontières primitives, sans objet métier sérialisé
- ajout de 22 sondes positives et négatives partagées, exécutées par les deux runners et concordantes dans
  les rapports de parité
- formules de censure, percentiles, Risk Score, fiabilité et histogrammes inchangées ; les deux divergences
  d’histogrammes de 2.12 restent visibles et le contrôle demeure informatif jusqu’au PBI 2.19

### Exécution interlangage du corpus partagé — PBI 2.12

- ajout de runners Python et TypeScript consommant les quinze mêmes cas `1.0`, leurs entrées, seeds et
  l’adaptateur `mca-prng-v1`, après validation du schéma et des invariants du corpus
- sérialisation canonique dans la forme `expected_result`, sans tolérance numérique, tri des histogrammes,
  reconstruction des champs absents ni duplication des règles statistiques
- comparaison séparée norme/Python, norme/TypeScript et Python/TypeScript, avec diagnostics distincts pour
  schéma ou corpus invalide, erreur moteur, divergence normative et divergence inter-moteurs
- rapports JSON et Markdown déterministes, contrôle informatif non intégré au profil `main`
- observation reproductible de 13 cas conformes et de deux divergences d’histogrammes : 100 buckets Python
  contre 51 centres impairs TypeScript sur `0..100`, puis représentants `50/9951` et `51/10050` contre la
  norme `50/9999` sur la plage discontinue
- aucun alignement des PBI 2.13 à 2.17, aucune modification de formule, résultat attendu, contrat moteur,
  DTO, API, MongoDB, `localStorage` ou contrôle qualité

### Risk Score, fiabilité et histogrammes de référence — PBI 2.11

- enrichissement du corpus normatif `1.0` avec dix cas discriminants, sans modifier les cinq cas 2.10 ni
  le contrat `mca-prng-v1`
- matérialisation du score `0.6667`, de son absence avec P90 manquant ou P50 nul, et des seuils exacts
  après arrondi normatif : CV `0.5/1/1.5`, IQR relatif `0.5/1`, pente `0.05/0.10/-0.15`
- ajout d’un histogramme continu agrégé en 51 buckets de représentants `0,2,..,100` et d’un cas discontinu
  aux représentants `50/9999`, avec comptes, masse, bornes et absence de buckets vides protégés
- matérialisation des divergences historiques ST-24/D-02, ST-25, ST-30/D-03 et ST-33, sans utiliser les
  moteurs comme oracle ni aligner leurs formules
- renforcement du validateur autonome : présence/formule du Risk Score, métriques et labels de fiabilité,
  représentants normatifs, résultats spécialisés et refus des scénarios dupliqués
- aucun runner du PBI 2.12, aucun alignement des PBI 2.13 à 2.16, aucun changement de DTO, API, MongoDB,
  `localStorage`, formule moteur ou contrôle qualité

### Cas d’entrées, modes, censures et percentiles — PBI 2.10

- ajout du corpus normatif `contracts/statistical-reference-corpus-v1.0.json` avec cinq cas minimaux
  couvrant les deux politiques de zéros, les deux modes, la fin exacte à l’horizon et les censures absente,
  partielle et totale
- établissement explicite des résultats depuis `STD-STAT-001`, l’ordre simulation-major et
  `mca-prng-v1`, avec tables de décomptes et de rangs prouvant l’ordre et l’identifiabilité de P50, P70 et
  P90 sans utiliser les moteurs Python ou TypeScript comme oracle
- ajout de 24 probes de rejet pour les bornes, types, samples utilisables et paramètres de mode, plus des
  contrôles des invariants interchamps et de la complétude documentaire et structurelle du périmètre 2.10
- aucun runner du PBI 2.12, changement de formule ou cas spécialisé du Risk Score, de la fiabilité ou des
  histogrammes du PBI 2.11 ; aucun changement de DTO, API, MongoDB ou `localStorage`

### Schéma du corpus de référence statistique — PBI 2.9

- ajout du contrat JSON Schema draft 2020-12 normatif `1.0`, fermé aux propriétés inconnues et lié à
  `STD-STAT-001` version `1.0`, `mca-prng-v1` et ses vecteurs canoniques
- séparation explicite, pour chaque futur cas, des entrées normalisées, de la seed uint32, des résultats
  attendus et des niveaux de preuve algorithmique, déterministe, de rejeu ou distributionnel
- ajout d’un contrôle autonome du métaschème et d’exemples positif/négatif minimaux, avec diagnostics
  localisés par JSON Pointer, mot-clé et chemin de schéma
- aucun corpus statistique des PBI 2.10–2.11, aucun runner moteur, changement de formule, migration de DTO,
  API, MongoDB ou `localStorage`

### Ordre logique des tirages et batching — PBI 2.8

- adoption d’une grille canonique simulation-major : chaque simulation reçoit un segment contigu de la
  suite `mca-prng-v1`, ordonné par semaine, de largeur `521` en `backlog_to_weeks` et `target_weeks` en
  `weeks_to_items`
- alignement du moteur local TypeScript sur les lignes row-major déjà produites par le backend ; après une
  fin anticipée du backlog, l’adaptateur avance en temps constant sur les slots réservés inutilisés
- résultats backend prouvés identiques pour des lots divisibles et non divisibles, dans les deux modes et
  avec censure absente, partielle ou totale
- vecteurs `mca-prng-v1`, formules de percentiles, Risk Score, fiabilité et histogrammes inchangés ; aucun
  corpus de parité du PBI 2.9 introduit

### PRNG contractuel commun — PBI 2.7

- remplacement de l’adaptateur NumPy backend et identification de l’algorithme bitwise frontend historique
  comme contrat commun `mca-prng-v1`, avec un état uint32 unique et un mapping d’indice exact par
  `floor(value * sampleCount / 2^32)`, sans modulo
- ajout de vecteurs canoniques figés dans `contracts/mca-prng-v1-vectors.json`, lus par les tests Python et
  TypeScript pour prouver l’égalité des sorties uint32 et des indices d’échantillonnage
- conservation des résultats frontend seed-à-seed ; changement volontaire des tirages backend pour une
  même seed historique à la suite de l’abandon de `numpy.random.default_rng`
- résultats déjà persistés laissés inchangés, sans suppression ni migration d’historique et sans changement
  de DTO, JSON, MongoDB ou `localStorage`
- égalité complète des simulations et indépendance du batching laissées aux PBI 2.8 à 2.17 ; version externe
  du contrat et règles de migration laissées au PBI 2.20

### Port de tirage déterministe — PBI 2.6

- introduction d’un port d’indices d’échantillons dans chaque langage, adapté aux tirages unitaires
  TypeScript et aux matrices vectorisées/batchées Python, sans seed ni bibliothèque aléatoire exposée aux
  moteurs
- composition d’un unique adaptateur NumPy depuis `command.seed` dans le service backend et d’un adaptateur
  conservant strictement l’ancien algorithme bitwise TypeScript dans les seuls chemins locaux qui tirent des
  échantillons ; le chemin HTTP continue de transmettre uniquement la seed
- injection du même port dans les deux modes Monte Carlo et dans les scénarios portefeuille, avec doubles de
  test contrôlant séquences, bornes, cardinalité et forme des tirages
- sorties déterministes, batching, censures, percentiles, histogrammes, Risk Score, DTO, JSON et persistences
  conservés ; le PRNG commun et l’indépendance de l’ordre des tirages restent réservés aux PBI 2.7 et 2.8

### Résolution de seed aux frontières d’exécution — PBI 2.5

- résolution backend extraite dans `backend/simulation_seed.py` : seed HTTP explicite validée sans
  altération ou valeur uint32 générée une seule fois avec `secrets`, avant la création de la commande
- résolution frontend déplacée hors du moteur statistique vers
  `frontend/src/hooks/simulationSeedResolver.ts`, avec `crypto.getRandomValues` obligatoire lorsque la seed
  est absente et suppression du repli `Date.now() >>> 0`
- commandes Python et TypeScript désormais limitées à une `SimulationSeed` déjà résolue ; propagation
  inchangée vers moteurs, réponses, MongoDB, `localStorage`, démo, portefeuille et rejeu
- contrats JSON, formats de persistance, PRNG, ordre et nombre des tirages, batching et formules statistiques
  inchangés ; tests ciblés ajoutés pour les bornes, l'appel unique, l'erreur Web Crypto et l'absence de
  génération dans les moteurs

### Value Objects statistiques prioritaires — PBI 2.4

- introduction, en Python et TypeScript, de Value Objects statistiques immuables pour la seed, les entrées de
  simulation, les percentiles, la fiabilité du throughput, l’histogramme et la complétion, conformément à
  `STD-STAT-001` version 1.0
- résolution complète des commandes métier par mode, validation stricte du throughput avant traitement des
  zéros, normalisation `round half up` de la fiabilité et de la complétion, et protection de l’ordre, de la
  masse et des clés fermées des résultats
- conversions explicites aux frontières HTTP, MongoDB et `localStorage`, sans changement de leurs champs ou
  formats primitifs, ni des PRNG, tirages, formules statistiques, lots ou comportements frontend-only
- ajout des tests Python et TypeScript de bornes, types invalides, modes, percentiles, seuils de fiabilité,
  histogrammes, complétion, round-trips et indépendance du domaine envers les frameworks

### Gate README de commit

- rétablissement de l'obligation d'inclure une évolution pertinente du `README.md` racine dans tout index
  Git non vide avant commit, quel que soit le type de changement stagé
- lecture explicite des statuts ajout, modification, suppression et renommage afin qu'un README supprimé,
  renommé, imbriqué ou modifié seulement dans le worktree ne puisse pas satisfaire la règle
- couverture de la garde par des scénarios purs et des mocks de commandes Git en lecture seule, sans
  modification de l'index réel

### Séparation DTO, domaine et persistance

- séparation des DTO HTTP, des modèles statistiques métier et des formats de persistance en Python et en
  TypeScript, avec conversions explicites aux frontières et modèles internes TypeScript en `camelCase`
- extraction de l'orchestration statistique Python hors de la route FastAPI et convergence des chemins
  backend et local vers un même `SimulationResult` métier côté frontend
- préservation des contrats JSON `/simulate` et historique, des documents Mongo, du schéma `localStorage`
  version 2, des migrations legacy et de tous les calculs statistiques existants
- ajout de contrôles architecturaux bloquant le recouplage du domaine, du moteur local, de l'UI et de la
  persistance avec les DTO HTTP

### Documentation statistique

- adoption de `STD-STAT-001` version 1.0, contrat normatif de parité et de reproductibilité statistiques :
  parité de rejeu exacte Python/TypeScript comme cible, seed uint32 explicite, entrées strictes, censure et
  percentiles absents, Risk Score d'autorité, fiabilité normalisée, histogramme commun, forme de réponse et
  frontière frontend-only orientés vers les PBI 2.3 à 2.8, sans modification des moteurs ni des tests
- ajout de la traçabilité complète entre les 49 exigences `STAT-PAR-*` et les 51 responsabilités `ST-*` de
  l'audit ; `RISK-003`, `RISK-004` et `RISK-005` restent `Partiellement couvert` tant que le contrat n'est
  ni implémenté, ni démontré par un corpus partagé, ni rendu bloquant
- publication de l'audit factuel du PBI 2.1 : 51 responsabilités Python/TypeScript inventoriées, chemins
  backend, démo et portefeuille cartographiés, équivalences déterministes séparées de l'égalité seed-à-seed
  et de l'équivalence distributionnelle, divergences reproductibles qualifiées puis orientées vers les PBI
  2.2 à 2.8, sans modification des moteurs, formules, seuils, tests ou gates
- consolidation de la frontière censurée sur 1 000 seeds : aucun biais interlangage démontré, sensibilité
  bidirectionnelle de P90 confirmée, et distinction explicite de la garde TypeScript qui produit un Risk
  Score nul lorsque P90 manque; précision brute des seuils de pente 0,05 et 0,10 également consignée
- clôture du PBI 2.1 après validation normative complète du profil `main`, Docker smoke compris; les risques
  statistiques restent `Partiellement couvert` jusqu'aux décisions et travaux des PBI 2.2 à 2.8
- précision de `RISK-003` à `RISK-005` avec les preuves de l'audit; ces risques restent partiellement couverts
  tant que le contrat, le corpus, l'alignement et la gate de parité ne sont pas réalisés

### Qualité et outillage

- ajout du reporting consolidé de stratégie de test : contrat JSON strict, modèle déterministe séparant
  référence globale, exécution profilée et couverture stratégique, restitution Markdown issue du même modèle,
  manifest de preuves et conclusions distinctes de conformité de gate et de complétude stratégique
- intégration du reporter au nœud `aggregate` pour les quatre profils, après vérification du dénombrement,
  Vitals et gouvernance, sans relancer les suites ni exiger le résultat final circulaire de l'agrégateur
- transport CI explicite des résultats `preflight`, `backend-static` et `frontend-static`, puis publication
  des snapshots JSON et Markdown comme artefacts du job `aggregate`

- correction du job CI `aggregate` : Node 22, le cache npm et `npm --prefix frontend ci` sont préparés avant
  l’agrégateur final, afin que la gouvernance des tests redécouvre Vitest et Playwright avec TypeScript
- correction du pré-push isolé : tous les chemins d’exécution du DAG (séquentiel, parallèle et nœud
  sélectionné) transmettent explicitement `MONTECARLO_E2E_PYTHON` avec l’interpréteur Python hôte au
  worktree, ce qui permet au serveur Playwright de retrouver `uvicorn` sans modifier les dépendances
- ajout du contrat indépendant `config/test-governance.json` et de son schéma pour gouverner par cas logique
  les skips, désactivations, expected failures, quarantaines et retries de Pytest, Vitest et Playwright, avec
  responsables, tickets, risques, échéances et mesure compensatoire obligatoire pour une quarantaine critique
- ajout d'un contrôle AST multi-framework unique dans `aggregate` : rejet des mécanismes non gouvernés,
  marqueurs inconnus, entrées invalides, expirées ou orphelines, tests critiques ignorés, quarantaines non
  exécutables et retries globaux ou masquant le premier échec, sans abaisser ni déplacer aucun seuil existant
- extension des reporters natifs avec résultat initial, séquence des tentatives et résultat final, puis
  production de `reports/test-governance-report.json` avec nombres, détails, expirations et taux d'instabilité
  exploitables par le PBI 1.10
- audit des trois appels `pytest.skip(...)` et des deux `skipif` existants : suppression des quatre gardes
  devenues inutiles et remplacement du skip Mongo par un échec explicite lorsque le service requis par le
  profil `main` est absent ; inventaire final sans skip ni métadonnée de gouvernance inventée
- migration des actions JavaScript de la CI vers leurs versions Node 24 natives : `actions/checkout@v6`,
  `actions/setup-python@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`,
  `actions/download-artifact@v8`, `docker/login-action@v4` et `docker/build-push-action@v7` ; retrait de
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` et ajout d’une conformité bloquante contre les anciennes versions ou
  la réintroduction du forçage, sans modifier le DAG, les chemins d’artefacts ni la publication GHCR
- recomposition des profils CI/CD `pr`, `main`, `nightly` et `release` autour d’un contrat JSON versionné,
  avec hiérarchie d’inclusion explicite, attribution factuelle de chaque cas et séparation stricte des
  portées `targeted`, `impacted` et `massive`
- remplacement du plan CI monolithique par un DAG `preflight` → branches backend/frontend/tests/E2E/release
  → `aggregate`, artefacts intermédiaires isolés, validation des cycles et conflits parallèles, jobs GitHub
  réellement parallèles et publication GHCR conservée après l’agrégateur du profil `main`
- correction de l’autonomie du job GitHub Actions `backend-tests` : le runner configure Node 22 avec le cache
  npm et installe les dépendances frontend avant la quality gate, afin que Pytest puisse charger TypeScript et
  `@playwright/test` ; les navigateurs Playwright restent installés uniquement dans le job `e2e`
- correction du transport des preuves vers `aggregate` : tous les producteurs publient
  `reports/test-execution-artifacts` et l’agrégateur fusionne les téléchargements dans ce même répertoire,
  ce qui restitue l’arborescence attendue pour promouvoir les artefacts backend, Vitest et E2E
- La tâche historique « Coverage: 8 terminaux » est remplacée par
  « Validation : profil main », fondée sur un DAG parallélisable.
- le contrôle de maintenabilité ignore uniquement les chemins suivis supprimés du workspace courant, afin
  qu’un retrait de l’ancien orchestrateur puisse être validé ; tous les fichiers suivis encore présents
  restent analysés avec les mêmes règles et seuils.
- justification des adaptations des contrôles qualité : la politique classe les nouveaux contrats,
  orchestrateurs et rapports en portée `massive` afin qu’ils ne puissent pas contourner le gate complet ;
  le contrôle DoD lit aussi le plan extrait afin de continuer à vérifier les commandes obligatoires. Aucun
  contrôle ni seuil n’est supprimé ou abaissé.

- ajout du contrôle bloquant de classification des tests dans les gates `fast`, `push`, `ci` et
  `Validation : profil main` : redécouverte en lecture seule, comparaison exacte de l'inventaire, validation du
  contrat, des règles, overrides et exemptions, empreinte du rapport d'exécution et exigence
  `unresolved = 0`; les 16 ambiguïtés historiques sont résolues automatiquement sans override ni exemption
- ajout du comptage déterministe des cas logiques, instances natives collectées/exécutées, skips, tentatives
  et retries pour Pytest, Vitest et Playwright, avec rapprochement exact à l'inventaire, schéma versionné,
  invariants détaillés et rejet explicite des collections incomplètes, orphelines ou ambiguës
- ajout du classificateur automatique du patrimoine Pytest, Vitest et Playwright : découverte AST des cas
  logiques, règles comportementales priorisées, rattachement aux finalités, domaines, risques et parcours,
  overrides exacts auditables et inventaire JSON reproductible, sans enforcement ni modification des profils
- ajout du modèle versionné de classification des cas logiques selon `STD-TEST-001` : catalogue de
  vocabulaires, domaines et règles de résolution, schéma JSON Draft 2020-12, documentation et tests de
  cohérence, sans classification du patrimoine ni modification des gates
- création de la matrice risques–contrôles et enrichissement des parcours critiques, avec distinction explicite
  entre maîtrise démontrée, couverture partielle et lacune planifiée
- audit de tous les fichiers Markdown suivis par Git, correction des accents, encodages et échappements
  Unicode, et vérification des liens internes et de la cohérence factuelle
- versionnement de `STD-TEST-001`, standard de classification, de qualité et de pilotage des tests, et
  alignement des références normatives dans le README, la DoD et l’architecture
- correction de la portabilité Linux des tests de la gate : la détection Windows passe par un seam dédié,
  le fallback `cmd.exe /c mklink /J` force d’abord l’échec du lien symbolique, et aucun test ne modifie plus
  globalement `os.name` ; les retries de suppression read-only, la suppression d’une jonction et les deux
  tests du comportement réel du système de fichiers sont couverts sans skip de plateforme
- ajout d’un ratchet de maintenabilité déterministe sur la taille, la complexité, les cycles, les
  directions de dépendance démontrables et le mojibake, avec baseline et exceptions justifiées versionnées
- découpage du moteur de maintenabilité entre collecte des métriques, analyse des dépendances, chargement de
  configuration, comparaison au ratchet et restitution CLI, tout en conservant un point d’entrée unique
- extension de la couverture Python à tous les fichiers exécutables versionnés sous `backend/`, `Scripts/`
  et à `run_app.py`, avec branches actives, seuil global et par fichier, absence de ligne rouge et contrôle
  bloquant d’un fichier exécutable manquant
- ajout d’un test unitaire déterministe du repli de téléchargement PDF quand l’API de sauvegarde directe
  échoue, sans modification du comportement de production ni du contenu PDF

### Frontend

- ajout d'une page PDF « Comparaison des hypothèses » après la synthèse portefeuille: qualité des historiques
  observés, stabilité des résultats simulés et crédibilité des hypothèses restent séparées, sans reconstruire
  de recommandation depuis les résultats statistiques
- retrait du diagnostic comparatif détaillé de l'interface de génération; seul un contrôle compact permet de
  choisir facultativement une référence de pilotage, sans sélection par défaut et hors du diagnostic métier
- distinction explicite dans le rapport entre recommandation issue des preuves, préconisation de démarche et
  référence de pilotage choisie comme convention de gouvernance
- libellé utilisateur `Indépendant` harmonisé dans la synthèse, les légendes et les pages du rapport; lecture
  prudente alignée sur le percentile P90 effectivement exposé et diagnostics d'équipe rendus sans concaténation
- alignement des diagnostics décisionnels entre l'interface et les rapports PDF simulation / portefeuille:
  statuts, justifications, actions conseillées, facteurs, qualité des données et incertitude réutilisent
  le langage décisionnel existant, sans modifier les calculs ni les recommandations
- mise en page de la synthèse PDF portefeuille stabilisée sur une seule page: tableau décisionnel,
  comparaison des probabilités lisible et hypothèses en deux colonnes; les pages scénario conservent
  leurs sauts de page dédiés
- harmonisation de la grammaire visuelle des graphiques Recharts et SVG: observations en barres, points pleins ou
  traits continus; moyenne mobile, moyenne glissante et courbe lissée pointillées; intervalle de variabilité en bande;
  probabilités continues. Les légendes d'interface et de rapport reproduisent désormais le style de chaque série.
- clarification sémantique des graphiques du rapport portefeuille: le throughput équipe,
  l'historique corrélé et les scénarios bootstrap sont distingués par des titres HTML et SVG
  cohérents; les scénarios synthétiques restent explicitement présentés comme reconstruits par bootstrap
  et leurs dates utilisent les utilitaires de calendrier local pour éviter toute dérive UTC
- centralisation du contrat de bornes Monte Carlo dans `src/simulationLimits.ts` et alignement
  des validations UI / simulation locale sur le backend: `n_sims` entre `1_000` et `200_000`,
  `target_weeks` entre `1` et `521`, `throughput_samples` entre `6` et `521` valeurs,
  `backlog_size` entre `1` et `1_000_000`, sans correction silencieuse des entrées invalides
- correction de la sémantique des simulations `backlog_to_weeks` censurées:
  percentiles identifiés sur le rang dans `n_sims`, courbe de probabilité plafonnée
  au vrai taux de complétion, `Risk Score` masqué si `P50` ou `P90` manque
- `backlog_to_weeks` ne code plus une non-terminaison par `521` seul: le frontend consomme
  et produit un `completion_summary` explicite (`completed_count`, `censored_count`,
  `censored_rate`, `horizon_weeks`) pour distinguer les censures des fins exactes à l'horizon
- les écrans simulation et les exports PDF n'affichent plus de percentile fictif ni de
  `Risk Score` incomplet: percentiles absents si non identifiables, score absent si `P50`
  ou `P90` manque, avec note utilisateur sur la limite d'horizon
- compatibilité préservée avec les historiques legacy: le recalcul frontend reste réservé
  aux anciens historiques quand les nouveaux champs ne sont pas encore présents
- propagation de la `seed` Monte Carlo dans tous les chemins de simulation frontend:
  contrat `ForecastRequestPayload` / `ForecastResponse`, appel backend, moteur local démo,
  rapport portefeuille, historique local et rejeu
- génération d'une `seed` unique par exécution logique frontend, conservée lors d'un rejeu
  d'historique sans réutiliser l'identifiant d'entrée comme graine
- suppression des derniers `Math.random()` du moteur de simulation frontend au profit d'un
  générateur pseudo-aléatoire déterministe seedé
- compatibilité préservée avec les historiques locaux legacy dépourvus de `seed`
- `Cycle Time` exprimé partout en jours calendaires côté frontend: calcul, types, noms de propriétés,
  graphiques, tooltips, cartes, démo et exports PDF
- versionnement de l'historique local de simulation avec `schemaVersion`, migration idempotente
  des anciennes entrées sans version et conversion unique des anciennes valeurs `Cycle Time`
  stockées en semaines vers des jours calendaires (`* 7`)
- renommage des propriétés `Cycle Time` pour expliciter l'unité (`*Days`) et éviter les champs ambigus
- typage explicite de `AppFlowContent` sur `OnboardingState`, `OnboardingActions` et `SimulationViewModel`, avec test du rendu nominal de l'étape PAT et garde runtime conservée pour une étape inattendue
- suppression de `client_context` du contrat frontend/backend de simulation: `POST /simulate` transporte maintenant uniquement les données Monte Carlo statistiques
- l'historique détaillé contextualisé par équipe reste strictement local au navigateur; le frontend ne remappe plus l'historique Mongo dans `useSimulationHistory`
- le mode portefeuille et les scénarios agrégés n'envoient plus de noms d'équipe ou de scénario au backend
- remplacement du scénario portefeuille `Conservateur` par `Historique corrélé`, construit à partir
  des semaines réelles communes à toutes les équipes pour conserver les variations partagées
  (vacances, incidents, ralentissements, dépendances temporelles) dans le moteur Monte Carlo
- correction de la formule du scénario portefeuille `Friction` pour l'aligner sur l'explication métier:
  une seule équipe conserve 100% de sa capacité, puis chaque équipe supplémentaire applique
  le même coût d'alignement (`optimistic * alignmentRate^(teamCount - 1)`, exposé avec borne
  d'exposant à `0` et pourcentage affiché identique au facteur réellement simulé)
- le throughput hebdomadaire Azure DevOps n'intègre plus de semaines calendaires incomplètes:
  seules les semaines ISO complètes du lundi au dimanche, entièrement contenues dans la période
  sélectionnée et déjà écoulées au moment du calcul, alimentent désormais l'historique de simulation
- extraction des utilitaires calendaires dans `src/date.ts` (`parseLocalIsoDate`, `startOfIsoWeek`,
  `nextMonday`, `previousSunday`, `getCompleteWeekRange`) pour fiabiliser l'alignement local des dates
  sans dérive UTC sur les chaînes `YYYY-MM-DD`
- alignement des stats `totalWeeks` / `usedWeeks`, des graphes throughput et des scénarios E2E sur ce
  nouveau filtre de semaines complètes, avec message explicite quand aucune semaine exploitable n'est disponible
- correction P0 du `Risk Score` pour garantir la même formule métier entre backend, écran et PDF:
  `backlog_to_weeks` utilise `(P90 - P50) / P50`, `weeks_to_items` utilise
  `(P50 - P90) / P50`, avec borne `0` si `P50 <= 0` ou si une ancienne réponse est incohérente
- suppression des derniers recalculs divergents du `Risk Score` dans le rapport portefeuille:
  les pages détail et la synthèse PDF utilisent maintenant les percentiles métier exposés
- ajout de tests de cohérence sur le `Risk Score` et les autres ratios (`cv`, `iqr_ratio`,
  `slope_norm`) pour vérifier la parité backend/frontend et les gardes-fous d'affichage
- `weeks_to_items` n'effectue plus de double recalcul systématique des percentiles:
  les nouvelles réponses API utilisent directement `result_percentiles`, avec fallback
  histogramme conservé uniquement pour les historiques legacy détectés
- durcissement du workflow GitHub Pages avec une seconde tentative de `actions/deploy-pages` quand GitHub renvoie un échec transitoire après création du déploiement
- correction de la CI Playwright: le job `frontend-tests` installe aussi les dépendances Python backend requises par `run_app.py` (`uvicorn`, FastAPI, etc.) avant `npm run test:e2e`
- stabilisation de `vitest run --coverage` sous Windows via `pool: "forks"` et `coverage.processingConcurrency: 1` pour éviter les erreurs V8 `ENOENT` sur `frontend/coverage/.tmp/coverage-*.json`
- couverture unitaire complétée sur `getProjectionReliabilityNotice` dans `src/utils/simulation.ts` pour supprimer la ligne rouge restante dans le rapport
- extraction et tests dédiés du calcul de `cycleTime` via `src/utils/cycleTime.ts`
- harmonisation du rendu `Cycle Time` avec les autres onglets graphiques, y compris légendes et libellés métier
- durcissement des mocks Playwright pour couvrir aussi l'historique client `/simulations/history` et les révisions Azure DevOps utilisées par le calcul de `cycleTime`
- correction du runtime GitHub Pages via `VITE_GITHUB_PAGES` pour garantir la démo publique sur `/` et la notice sur `?connect=true`
- remplacement du bandeau démo global par un badge `Démo` dans l'en-tête de l'écran simulation
- nouveau point d'entrée démo sur l'écran de choix d'équipe avec texte d'orientation simulation vs portefeuille
- badge `Démo` visible aussi sur l'écran de choix d'équipe en mode démo
- axe Y des graphes throughput/distribution borné à `0` et ajout d'une marge haute sur le throughput pour éviter les barres collées au plafond
- couverture unitaire renforcée sur `SimulationChartTabs.tsx` et scénario E2E démo aligné sur le nouveau badge
- couverture unitaire complétée sur `adoPlatform.ts`, `ProjectStep.tsx`, `SimulationChartTabs.tsx`,
  `SimulationResultsPanel.tsx`, `src/utils/simulation.ts` et `src/utils/cycleTime.ts`
- couverture E2E durcie sur l'onboarding démo / déconnexion / thème et sur les branches directes
  `adoClient.ts`, avec stabilisation des scénarios Playwright associés
- refactor de `App.tsx` en modules dédiés: `AppFlowContent.tsx`, `appNavigation.ts`, `appShellSections.tsx`, `appTheme.ts`
- extraction des helpers API dans `src/apiHelpers.ts` pour séparer les branches de normalisation du wrapper `api.ts`
- extraction du cœur forecast vers `src/hooks/simulationForecastCore.ts`, `simulationForecastService.ts` restant une façade mince
- ajout d'un jeu de tests unitaires et E2E ciblé pour remonter la couverture vitale (`coverage.spec.js`, `AppFlowContent.test.tsx`, `simulation.test.ts`, hooks/tests associés)
- alignement du mapping vital `SLA Identite` sur les fichiers réels après refactor (`docs/vitals-coverage-map.json`)
- utilitaires centralisés `src/date.ts`, `src/storage.ts`, `src/utils/math.ts`, `src/utils/simulation.ts`
- gestion granulaire des erreurs Azure DevOps (`401/403/404/429/5xx`) via `src/adoErrors.ts`
- avertissement explicite en cas de chargement partiel des batches de work items
- contexte simulation unifié `src/hooks/SimulationContext.tsx`
- centralisation des accès `localStorage` via `storage.ts`
- extraction de l'export CSV throughput vers `src/utils/export.ts`
- extraction de la logique forecast vers `src/hooks/simulationForecastService.ts`
- extraction de la logique portefeuille vers `src/hooks/usePortfolio.ts`
- extraction de la génération du rapport portefeuille vers `src/hooks/usePortfolioReport.ts`
- extraction du chargement des options d'équipe vers `src/hooks/useTeamOptions.ts`
- extraction de la persistance des quick filters vers `src/hooks/useSimulationQuickFilters.ts`
- simplification du contrat de `useSimulationAutoRun` via un objet `params`
- libellés métier clarifiés dans l'UI portefeuille/simulation
- calcul du `risk score` harmonisé sur les percentiles effectivement affichés
- typages simulation segmentés (`SimulationForecastControls`, `SimulationDateRange`, `SimulationResult`, `ChartTab`)
- écran simulation chargé en lazy + import dynamique du module rapport/PDF
- accessibilité du chargement renforcée dans `SimulationResultsPanel`
- cache mémoire des options d'équipe portefeuille (`org::project::team`)
- génération du rapport portefeuille parallélisée (`Promise.allSettled`) avec progression visible
- tolérance aux échecs partiels en portefeuille
- persistance locale de la configuration rapide par scope `org::project::team`
- application manuelle de la configuration rapide depuis la modale portefeuille
- résumés du panneau simulation reformulés en libellés métier
- mode portefeuille recomposé pour une lecture plus claire des critères généraux
- rapport portefeuille PDF enrichi avec page de synthèse décisionnelle
- refonte des scénarios portefeuille: `Optimiste`, `Arrime`, `Friction`, `Historique corrélé`
- ajout d'un graphe comparatif des 4 courbes de probabilité dans le PDF
- alignement CI front sur les 4 scénarios portefeuille
- ordre des scénarios harmonisé partout
- correction d'un bug de cohérence `Risk Score` entre synthèse PDF et pages détail
- correction du déclenchement multi-téléchargements PDF
- robustesse e2e renforcée sur l'écran simulation
- `frontend/tests/e2e/coverage.spec.js` normalisé en UTF-8

### Backend et tests

- centralisation des bornes de contrat Monte Carlo dans `backend/simulation_limits.py` et
  validation `422` explicite avant simulation pour `n_sims`, `target_weeks`,
  `throughput_samples` et `backlog_size`, avec tests backend/frontend/E2E des bornes min/max
  et maintien du moteur batché sans allocation globale `n_sims x horizon`
- le moteur Monte Carlo backend n'alloue plus de matrice complète `n_sims x horizon`:
  les tirages sont maintenant exécutés par lots de taille centralisée avec un seul générateur
  pseudo-aléatoire par simulation, ce qui borne la mémoire sans casser la reproductibilité
- ajout de tests backend pour verrouiller la reproductibilité entre tailles de lots et le
  traitement correct d'un dernier lot incomplet
- `backlog_to_weeks` distingue maintenant les simulations terminées des censures à l'horizon:
  nouvelle structure `FinishWeeksSimulation`, percentiles calculés uniquement sur les
  simulations terminées, `completion_summary` persisté dans l'historique Mongo et fin exacte
  à `521` semaines distincte d'une censure
- `risk_score` backend devient absent quand `P50` ou `P90` n'est pas identifiable, sans
  remplacement silencieux par `0` ou `521`
- ajout de tests backend/frontend pour couvrir les cas limites de censures complètes, de fin
  exacte à l'horizon, d'absence de percentiles et d'absence de `Risk Score`
- ajout d'un `seed` Monte Carlo optionnel sur `POST /simulate`, valide entre `0` et `4294967295`, renvoyé dans la réponse et persisté dans l'historique Mongo pour rejouer un tirage à l'identique
- ajout de tests API et store pour garantir la reproductibilité avec un `seed` fourni, la génération automatique d'un `seed` valide, et la compatibilité des lignes d'historique legacy dépourvues de `seed`
- refonte de `Scripts/check_identity_boundary.py` autour des règles explicites `IDENTITY-001` à `IDENTITY-008`, avec collecte testable des violations sur les contrats `POST /simulate`, la persistance Mongo, l'historique backend, les proxies locaux et les appels Azure DevOps côté serveur
- ajout de `tests/test_identity_boundary.py` avec dépôts temporaires synthétiques pour verrouiller les cas conformes et les régressions interdites, sans dépendre du répertoire `AppData\Local\Temp\pytest-of-*` sous Windows
- renommage de l'étape CI en `Enforce Azure DevOps identity boundary` et maintien de son caractère bloquant avant les tests backend
- suppression de `ClientContext` du modèle API backend et persistance Mongo limitée aux seules données
  statistiques minimisées, reliées à un identifiant pseudonyme non dérivé d'Azure DevOps
- alignement du smoke test Docker CI sur le contrat courant de `POST /simulate`:
  le workflow n'envoie plus l'ancien champ `capacity_percent`, ce qui évite les `422`
  dus à `extra="forbid"` tout en gardant le garde-fou de dérive de contrat
- projection défensive de `/simulations/history` pour exclure explicitement les anciens champs sensibles Azure DevOps, même sur des documents legacy
- ajout du script `Scripts/scrub_simulation_identity.py` pour nettoyer les anciens champs d'identité Azure DevOps en `dry-run` par défaut puis `--apply`
- couverture de `backend/simulation_store.py` complétée sur les branches défensives (`connect`, `_ensure_collection`, `_run_with_reconnect`, `close`) pour supprimer la marge devenue trop juste autour de la persistance Mongo
- correction de la sémantique des percentiles Monte Carlo selon le mode:
  `backlog_to_weeks` utilise un quantile discret conservateur `higher`, `weeks_to_items`
  un quantile de survie `lower`, avec tests discrets ciblés sur l'API et `mc_core`
- remplacement du client de test `fastapi.testclient.TestClient` par un helper local basé sur `httpx` pour éviter le warning de dépréciation Starlette/FastAPI dans les tests API
- auto-réparation de l'index TTL Mongo `last_seen_1` au démarrage en cas de conflit d'options historique
- tri des imports `slowapi` dans `backend/api.py` pour conformité Ruff/isort
- découpage d'une compréhension de liste dans `tests/test_api_simulate.py` pour respecter la limite de longueur de ligne
- ajout de `tests/test_api_static.py` et couverture complétée de `backend/api.py` / `backend/api_static.py`
  sur le `lifespan` FastAPI et le montage du frontend statique, avec répertoires temporaires locaux
  au workspace pour rester stables sous Windows
- DoD et garde-fous repo alignés sur `pytest` / FastAPI plutôt que `manage.py test`
