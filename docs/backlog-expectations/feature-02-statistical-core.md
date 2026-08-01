# Feature 2 — Garantir la fiabilité du cœur statistique

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document conserve les attendus, décisions et preuves propres à
chaque PBI de la Feature.

## Phase A — Déterminisme d’exécution : PBI 2.5 à 2.8

### 2.5 — Seed résolue exclusivement aux frontières d’exécution

- résoudre la seed aux frontières API, UI et démo avant l’appel du moteur ;
- conserver exactement une seed uint32 déjà validée ;
- supprimer les générations ou normalisations silencieuses dans le cœur ;
- ne pas injecter ici l’horloge ou les identifiants techniques sans effet statistique.

### 2.6 — Port de tirage déterministe disponible dans les deux moteurs

- définir une interface minimale de tirage consommée par les moteurs ;
- remplacer l’accès direct aux bibliothèques aléatoires dans la logique Monte Carlo ;
- permettre une source déterministe de test ;
- ne choisir ni ne déployer encore le PRNG commun.

Architecture introduite par le PBI 2.6 et conservée :

- le port Python demande des matrices d’indices afin de préserver la vectorisation et les lots existants ;
- le port TypeScript demande un indice unitaire afin de préserver l’ordre historique des simulations
  locales et du bootstrap portefeuille ;
- les services et hooks restent les seuls lieux de composition, et les moteurs ne dépendent que du port ;
- les adaptateurs transitoires NumPy et Mulberry32 livrés par le PBI 2.6 sont remplacés par le contrat
  commun du PBI 2.7, sans changer les signatures ni la composition.

### 2.7 — PRNG contractuel commun opérationnel en Python et TypeScript

- implémenter le même PRNG contractuel dans les deux langages ;
- définir son état, son domaine, sa sortie et ses vecteurs de vérification ;
- prouver l’égalité des suites de nombres produites ;
- ne pas aligner dans ce PBI les percentiles, la fiabilité ou les histogrammes.

Implémentation retenue :

- le contrat est identifié par `mca-prng-v1`, avec une seed et un état uint32 dans `0..4294967295`,
  une sortie primitive uint32 et un `sampleCount` entier strictement positif ;
- la transition reprend exactement les constantes et opérations bitwise TypeScript historiques, ramène
  chaque opération sur 32 bits et n’emploie aucune opération flottante pour faire évoluer l’état ;
- l’indice est calculé par `floor(value * sampleCount / 2^32)`, sans réduction modulo ;
- `contracts/mca-prng-v1-vectors.json` fige l’unique jeu de vecteurs partagé par les tests Python et
  TypeScript pour les sorties uint32 et les indices d’échantillonnage ;
- le frontend conserve ses résultats seed-à-seed, tandis que l’abandon volontaire du générateur NumPy
  peut modifier le rejeu backend d’une seed antérieure au PBI 2.7 ;
- les résultats persistés restent inchangés, sans suppression ou migration d’historique et sans ajout aux
  DTO, au JSON, à MongoDB ou à `localStorage` ;
- l’ordre logique et l’indépendance du batching restent réservés au PBI 2.8 ; la version externe du
  contrat et les règles de migration restent réservées au PBI 2.20.

### 2.8 — Ordre logique des tirages stable et indépendant du batching

- figer l’ordre logique de consommation des tirages ;
- rendre les résultats indépendants du découpage en lots ;
- couvrir les deux modes, les censures et les changements de taille de batch ;
- ne pas introduire le corpus complet de parité.

Implémentation retenue :

- l’ordre canonique est simulation-major, puis semaine-major dans chaque simulation ;
- chaque simulation réserve une ligne de `521` slots en `backlog_to_weeks` ou de `target_weeks` slots en
  `weeks_to_items` ;
- une fin anticipée utilise seulement le préfixe nécessaire au résultat, puis réserve les slots restants
  avant la simulation suivante ; le frontend avance l’état en temps constant et le backend conserve ses
  lignes vectorisées en ordre C ;
- les lots backend ne sont que des plages contiguës de lignes complètes : leur taille et leur dernier lot
  incomplet ne changent ni les trajectoires ni les censures ;
- les preuves ciblées couvrent les deux modes, les censures absente, partielle et totale et des tailles de
  lots divisibles et non divisibles, sans fixture sérialisée de résultats statistiques.

## Phase B — Corpus partagé : PBI 2.9 à 2.12

### 2.9 — Schéma du corpus de référence statistique versionné

- définir un format sérialisé strict et versionné ;
- distinguer entrées normalisées, résultats attendus et niveau de preuve ;
- porter la version normative `1.0` et la seed ;
- valider le schéma indépendamment des moteurs.

Implémentation retenue :

- `contracts/statistical-reference-corpus-v1.0.schema.json` est l’autorité JSON Schema draft 2020-12,
  fermée à toute propriété inconnue et liée à `STD-STAT-001` version `1.0` et `mca-prng-v1` ;
- chaque cas sépare identifiant, description, niveau de preuve normatif, entrée normalisée, seed uint32 et
  résultat attendu ; les deux modes imposent uniquement leur paramètre actif et leur forme de résultat ;
- types, bornes, cardinalités et invariants structurels sont portés par le schéma ; les relations
  arithmétiques interchamps sont documentées dans son `$comment` normatif sans extension propriétaire ;
- `Scripts/validate_statistical_reference_corpus.py` valide le métaschème, un exemple positif minimal et un
  contre-exemple minimal, avec fichier, JSON Pointer, mot-clé et chemin de schéma dans chaque diagnostic ;
- aucun cas statistique complet, runner moteur, changement de formule, migration de DTO, API, MongoDB ou
  `localStorage` n’est introduit.

### 2.10 — Cas de référence des entrées, modes, censures et percentiles disponibles

- couvrir bornes, types invalides, traitement des zéros et paramètres actifs ;
- couvrir les deux modes, la fin exacte à l’horizon, les censures totale et partielle ;
- couvrir l’identifiabilité et l’ordre de P50, P70 et P90 ;
- utiliser des cas lisibles et déterministes, sans dépendre d’un moteur comme oracle.

Implémentation retenue :

- `contracts/statistical-reference-corpus-v1.0.json` contient cinq cas minimaux : capacité avec zéro exclu,
  délai avec zéro inclus sans censure, fin exacte à 521, censure partielle et censure totale ;
- les résultats des cas de rejeu sont dérivés de la récurrence uint32 `mca-prng-v1`, vérifiée d’abord contre
  son vecteur canonique, puis des règles de cumul et de rang de `STD-STAT-001`, sans moteur Python ou
  TypeScript comme oracle ;
- le cas partiel produit 748 fins et 252 censures : les rangs 500 et 700 donnent P50 = 518 et P70 = 521,
  tandis que P90 reste absent car le rang 900 n’est pas identifiable ;
- 24 probes autonomes couvrent longueurs, types, bornes, zéros utilisables, paramètres manquants ou
  inactifs, mode et seed ; des probes positives protègent aussi les maxima inclusifs ;
- le contrôle vérifie seed, nombre de samples utilisés, ordre des percentiles, masse et ordre structurels,
  comptes et taux de censure, identité des cinq cas et documentation de leur dérivation ;
- aucun runner moteur, changement de formule, cas dédié au Risk Score, à la fiabilité ou aux histogrammes,
  ni migration de DTO, API, MongoDB ou `localStorage` n’est introduit.

### 2.11 — Cas de référence du Risk Score, de la fiabilité et des histogrammes disponibles

- couvrir le calcul et l’absence du Risk Score ;
- couvrir les seuils exacts de fiabilité après arrondi normatif ;
- couvrir histogrammes exacts et agrégés, masse et représentants ;
- inclure les cas qui matérialisent les divergences historiques recensées par l’audit.

Implémentation retenue :

- dix cas discriminants enrichissent le corpus `1.0`; les preuves 2.10 du score `0.6667`, de l’histogramme
  exact à six valeurs et du score absent lorsque P90 manque restent inchangées et sont réutilisées sans
  créer de doublon ;
- les gardes couvrent P90 absent et P50 nul ; les seuils isolés après `round half up` sont `cv = 0.5`,
  `1` et `1.5`, `iqr_ratio = 0.5` et `1`, puis `slope_norm = 0.05`, `0.10` et `-0.15`, avec les quatre
  labels et l’ordre de priorité normatifs ;
- le cas continu `0..100` produit 51 buckets de largeur 2, de représentants `0,2,..,100`; le cas
  discontinu `0..99 + 10000` produit les représentants `50` et `9999`; chaque histogramme conserve une
  masse de `1000` et aucun bucket vide ;
- ST-24/D-02, ST-25, ST-30/D-03, ST-32 à ST-34 sont matérialisés sans modifier les formules actuelles des
  moteurs : la référence normative documente notamment les anciens centres divergents `50/9951` et
  `51/10050`, puis fixe `50/9999` ;
- le validateur recalcule indépendamment les gardes/formules du score et toutes les métriques/labels de
  fiabilité, protège les représentants et résultats attendus, et refuse aussi deux scénarios identiques sous
  des identifiants différents ;
- aucun runner Python ou TypeScript du PBI 2.12, aucun alignement des PBI 2.13 à 2.16 et aucune modification
  de DTO, API, MongoDB ou `localStorage` n’est introduit.

### 2.12 — Corpus partagé exécuté dans les deux moteurs

- fournir un runner Python et un runner TypeScript du même corpus ;
- produire des sorties canoniques comparables ;
- distinguer échec de schéma, échec moteur et divergence de résultat ;
- ne rendre aucun contrôle bloquant dans ce PBI.

Implémentation retenue :

- `Scripts/run_statistical_reference_corpus.py` valide le métaschème, le corpus et les invariants 2.10/2.11
  avant toute exécution, puis orchestre les deux runners sur le même fichier `1.0` ;
- `Scripts/statistical_corpus_runner.py` compose les Value Objects et le service Python existants ;
  `frontend/src/statisticalCorpusRunner.ts` compose le moteur local et l’adaptateur `mca-prng-v1`
  existants, chargé par un pont Node après une seconde validation autonome ;
- les sorties conservent exactement la présence des champs, les valeurs et l’ordre des distributions dans
  la forme snake_case de `expected_result`; aucun arrondi, tolérance, tri ou calcul statistique n’est ajouté
  par les runners ;
- `Scripts/statistical_parity_report.py` qualifie séparément `schema_invalid`/`corpus_invalid`,
  `engine_error`, `normative_divergence` et `engine_divergence`, avec JSON Pointer, valeurs exactes et
  résultats canoniques complets dans le rapport JSON ;
- les rapports déterministes `reports/statistical-parity-report.json` et `.md` sont informatifs et ne sont
  pas inclus dans le profil `main`; leur promotion en gate relève toujours du PBI 2.21 ;
- treize cas sont conformes dans les deux moteurs. Les deux cas d’histogramme agrégé exposent les écarts
  historiques attendus : Python `100` buckets contre TypeScript `51` centres impairs sur `0..100`, puis
  `50/9951` contre `51/10050` sur la plage discontinue, la norme demandant `50/9999` ;
- aucune divergence n’est corrigée, aucun moteur ou contrat externe n’est modifié et les alignements restent
  affectés aux PBI 2.13 à 2.17.

## Phase C — Alignement statistique : PBI 2.13 à 2.17

### 2.13 — Validation normalisée et forme des résultats alignées

- aligner validations, paramètres actifs, valeurs absentes et forme normative de réponse ;
- conserver les DTO et persistances comme frontières primitives ;
- éviter toute coercion ou valeur sentinelle divergente ;
- ne modifier aucune formule statistique relevant des PBI suivants.

Implémentation retenue :

- les fabriques Python et TypeScript consomment une entrée normalisée fermée, entièrement explicite,
  limitée à des entiers finis dans les bornes de `STD-STAT-001`, avec au moins six observations après la
  politique des zéros ;
- la seed est un `uint32`, les champs inconnus sont refusés et seul le paramètre du mode actif peut être
  présent ; les frontières de transport harmonisent leurs valeurs par défaut avant la création métier ;
- les mappers exigent une réponse canonique fermée et omettent strictement Risk Score et complétion
  indisponibles, sans coercition ni sentinelle ;
- les DTO HTTP, payloads JSON, documents MongoDB et objets `localStorage` restent primitifs ; aucun Value
  Object ou objet métier ne franchit ces frontières ;
- `contracts/statistical-validation-probes-v1.0.json` contient 22 sondes positives et négatives exécutées
  par les deux runners ; le rapport constate 22 verdicts identiques ;
- aucune formule de censure, percentile, Risk Score, fiabilité ou histogramme n’est modifiée. Les deux
  divergences d’histogrammes restent visibles et la parité reste informative jusqu’au PBI 2.21.

### 2.14 — Censures, percentiles et Risk Score alignés

- aligner les règles de censure ;
- aligner les rangs et quantiles de P50, P70 et P90 ;
- aligner le Risk Score et son arrondi d’autorité ;
- préserver les percentiles absents sans reconstruction depuis l’histogramme.

Implémentation retenue :

- les deux moteurs conservent uniquement les durées terminées avec la population totale ; une fin exacte à
  l’horizon `521` reste distincte d’une censure et aucune non-terminaison n’est encodée comme durée ;
- `backlog_to_weeks` utilise les rangs `ceil(p × n_sims / 100)` et omet tout rang non atteignable ;
  `weeks_to_items` utilise les quantiles de survie discrets pour P50, P70 et P90 uniquement ;
- `SimulationPercentiles` est l’autorité unique de la formule et de l’arrondi rationnel `round half up` à
  quatre décimales du Risk Score dans les deux langages ; API, historique, interface et rapports conservent
  sa valeur sans recalcul ;
- P50 ou P90 manquant, ainsi que `P50 <= 0`, produisent une absence stricte du score ; les historiques
  legacy sans score restent lisibles sans reconstruction ;
- les percentiles absents ne sont jamais reconstruits depuis l’histogramme, y compris dans les hooks de
  présentation et les rapports ;
- six cas existants du corpus forment le périmètre 2.14 et les deux runners les démontrent. Les métriques et
  labels de fiabilité, les géométries d’histogrammes et l’enforcement de parité restent respectivement dans
  les PBI 2.15, 2.16 et 2.21.

### 2.15 — Métriques et labels de fiabilité du throughput alignés

- aligner moyenne, variance de population, quartiles et pente ;
- appliquer l’arrondi `round half up` avant les seuils ;
- appliquer exactement l’ordre de catégorisation normatif ;
- prouver les cas limites, notamment six et sept observations.

Implémentation retenue :

- `backend/throughput_reliability.py` et `frontend/src/domain/throughputReliability.ts` sont les autorités
  uniques du calcul : moyenne, variance et écart-type de population, quartiles linéaires et pente des
  moindres carrés avec `x[i] = i`; les Value Objects portent la normalisation et la catégorisation ;
- les trois métriques exposées sont arrondies à quatre décimales par `round half up` avant les seuils, puis
  les labels sont évalués une seule fois dans l’ordre `non fiable`, `fragile`, `incertain`, `fiable` ;
- un résultat autrement fiable est dégradé en `incertain` pour six ou sept observations ; les séries
  non fiables, fragiles ou incertaines conservent leur catégorie prioritaire ;
- Python n’emploie plus `numpy.percentile` ni `numpy.polyfit`, et `mc_core.py` comme
  `frontend/src/utils/simulation.ts` ne portent plus de calcul concurrent ;
- le corpus conserve les preuves à six observations et ajoute `reliability-seven-observations-degraded`,
  dérivé indépendamment de `STD-STAT-001` et `mca-prng-v1`; les deux runners concordent exactement sur les
  métriques, le label, les percentiles et les comptes `275/441/284` ;
- le validateur commun applique les invariants 2.10 à 2.15 au corpus candidat avant les deux runners ; les
  statistiques brutes à six et sept observations et tous les seuils sont vérifiés depuis des résultats
  littéraux dérivés du standard, sans prendre un moteur comme oracle ;
- les tests métier de la frontière HTTP refusent un Risk Score négatif et ceux de la commande résolue
  couvrent sa fermeture et sa construction commune ; les anciennes lignes rouges correspondantes ne
  subsistent plus dans le rapport de couverture ;
- les seize cas donnent quatorze conformités. Les deux seules divergences restent les histogrammes agrégés
  du PBI 2.16 ; le rejeu exact du PBI 2.17 et l’enforcement informatif avant 2.21 sont inchangés.

### 2.16 — Construction des histogrammes alignée

- remplacer les constructions historiques divergentes par l’algorithme normatif ;
- appliquer `right = min(max, left + width - 1)` ;
- appliquer `x = floor((left + right) / 2)` ;
- garantir au plus 100 buckets, la masse et les représentants attendus ;
- invalider ou migrer explicitement toute référence historique devenue incompatible.

Implémentation retenue :

- `backend/histogram.py` et `frontend/src/domain/histogram.ts` sont les autorités uniques de construction ;
  l’histogramme exact est conservé jusqu’à 100 valeurs distinctes, puis la largeur, l’index, les bornes
  inclusives tronquées et le plancher du représentant suivent `STAT-PAR-037` à `STAT-PAR-039` ;
- les chemins historiques `numpy.histogram` avec centres flottants arrondis et
  `Math.round(left + width / 2)` sans borne droite réelle sont supprimés des moteurs ; les présentations,
  mappers et runners ne recalculent aucune géométrie ;
- le validateur autonome rejoue scalairement `mca-prng-v1` pour les cas à une semaine et reconstruit
  indépendamment représentants et effectifs, sans importer Python ou TypeScript comme oracle ;
- les tests des deux langages couvrent histogrammes exacts, plage continue `0..100`, discontinuité
  `0..99 + 10000`, borne droite extrême et plage fortement asymétrique, avec ordre, comptes positifs,
  limite de buckets et masse exacte ;
- les sorties historiques Python à 100 buckets ou `50/9951`, et TypeScript aux centres impairs ou
  `51/10050`, restent documentées mais sont invalidées comme références courantes ; aucun historique
  persistant n’est migré et aucune frontière primitive ni version de contrat n’est modifiée ;
- les seize cas concordent exactement avec la norme et entre moteurs. Le rapport reste
  `informational` jusqu’au PBI 2.21 ; le rejeu exact et la gouvernance de version restent réservés aux
  PBI 2.17 et 2.20.

### 2.17 — Rejeu exact interlangage démontré sur le corpus versionné

- démontrer l’égalité exacte des résultats normatifs à entrée, seed et version identiques ;
- couvrir les deux modes, censures, percentiles, score, fiabilité et histogrammes ;
- vérifier plusieurs tailles de batch ;
- produire une preuve distincte de la seule équivalence distributionnelle.

Implémentation retenue :

- `.venv\Scripts\python.exe Scripts/run_statistical_exact_replay.py` valide d’abord indépendamment le
  schéma, le corpus `1.0`, ses invariants et la couverture des deux modes, censures absente, partielle et
  totale, percentiles complets, partiels ou absents, Risk Score présent ou absent, quatre labels de
  fiabilité et histogrammes exacts ou agrégés ; aucun moteur n’est appelé si cette autorité est invalide ;
- le corpus et son `expected_result` restent la seule autorité de résultat : les seize cas sont exécutés
  une fois dans TypeScript et quatre fois dans Python, avec les batches backend `125`, `128`, `1000` et
  `2048`, soit `8 × 125`, `7 × 128 + 104`, un lot exactement égal aux `1000` simulations et un lot
  supérieur à cette population ;
- chaque exécution moteur est comparée directement à l’attendu versionné avant toute comparaison mutuelle.
  Le comparateur exige exactement présence des champs, types primitifs JSON, valeurs, longueurs, ordre des
  distributions et forme canonique, sans tolérance numérique, arrondi, tri correctif ou normalisation
  silencieuse ;
- l’indépendance du batching est établie cas par cas lorsque les quatre exécutions Python concordent chacune
  avec le corpus, et non par la prise d’un batch comme oracle ; les quatre résultats Python sont aussi
  comparés au résultat TypeScript ;
- `reports/statistical-exact-replay-evidence.json` constitue la preuve déterministe exploitable localement
  et en revue : 16 cas, 64 exécutions Python, 16 exécutions TypeScript, 80 comparaisons normatives exactes,
  64 comparaisons interlangages exactes, 16 cas indépendants du batching et 0 diagnostic ;
- toute différence expose le cas, le moteur, la taille de batch, le chemin JSON divergent, les états
  attendu et obtenu et la classification `engine_error`, `normative_divergence` ou
  `interlanguage_divergence` ; un corpus ou un plan de batch invalide et un moteur inexécutable produisent
  un échec non nul ;
- `proof_kind = exact_replay` et `distributional_equivalence = not_evaluated` séparent explicitement le
  rejeu exact de l’équivalence distributionnelle. L’enforcement reste `informational` sans protocole
  distributionnel du PBI 2.18, consolidation générale du PBI 2.19, décision de compatibilité du PBI 2.20
  ni intégration au profil `main` du PBI 2.21.

## Phase D — Gouvernance de la parité : PBI 2.18 à 2.21

### 2.18 — Protocole de parité distributionnelle versionné et testable

- rendre explicitement versionnée la population de seeds du protocole ;
- définir les scénarios et les entrées couverts ;
- définir les métriques distributionnelles comparées ;
- définir les règles de traitement des censures, des percentiles absents et des résultats non
  identifiables ;
- établir et justifier les seuils ou intervalles d’acceptation ;
- maîtriser les faux positifs et la variabilité d’échantillonnage ;
- rendre le protocole reproductible ;
- distinguer explicitement la preuve distributionnelle du rejeu exact ;
- produire une preuve dans un format exploitable par le futur rapport consolidé.

Aucune valeur du protocole n’est arrêtée par ce raffinement. Les décisions statistiques seront établies
pendant l’exécution du PBI 2.18 à partir du standard, de l’audit historique et de preuves documentées.

Implémentation retenue :

- le protocole fermé `mca-statistical-distributional-parity` `1.0` référence `STD-STAT-001`, le corpus
  `1.0`, `mca-prng-v1` et une population SHA-256 versionnée de 256 seeds, répartie en deux cohorts
  disjointes de 128 ; Python et TypeScript ne reçoivent jamais les mêmes seeds et aucun moteur ne sert
  d’oracle ;
- cinq scénarios issus des seules entrées du corpus couvrent les deux modes, distribution discrète exacte,
  histogramme agrégé, censure absente, partielle et totale, tailles de `1 000` à `4 000` simulations et
  cohorts de 8 à 128 seeds ; `expected_result` n’entre dans aucun plan d’exécution ;
- 49 métriques comparent CDF discrètes, taux de complétion/censure, présence puis valeurs conditionnelles de
  P50/P70/P90 et du Risk Score ; la fiabilité, déterministe par entrée, reste une garde exacte et la censure
  totale une garde structurelle, sans fabriquer de percentile ni de score ;
- l’équivalence utilise bandes DKW ou intervalles Newcombe–Wilson ; la divergence utilise 2 047
  permutations de blocs de seeds. Bonferroni protège les régions simultanées et Holm ajuste les valeurs p
  au risque familial `0,05`; l’absence de puissance devient toujours `inconclusive` ;
- la calibration PCG64 contrôlée exécute 200 répétitions sur 12 couples taille de cohort/taille de
  simulation, trois lois nulles et quatre écarts décisionnels. Elle observe 0 famille faussement positive
  sur 200 sous une enveloppe binomiale 99 % de 18 et une puissance de `1,00` sur chaque alternative au
  design de production ; deux exécutions produisent exactement le même artefact ;
- `Scripts/validate_statistical_distribution_protocol.py`,
  `Scripts/validate_statistical_distribution_calibration.py` et
  `Scripts/validate_statistical_distribution_evidence.py` sont indépendants des moteurs et refusent forme,
  version, empreinte, résumé ou artefact incohérent ;
- `reports/statistical-distribution-evidence.json` conclut `match` sur 5 scénarios et 49 métriques, avec
  0 divergence, 0 résultat non concluant et une empreinte canonique stable ; les tests couvrent aussi
  `divergence`, `inconclusive`, `invalid`, les erreurs de version, protocole, moteur et infrastructure ;
- `Scripts/run_statistical_distribution.py` reste informatif pour tout résultat statistiquement valide et échoue sur invalidité ou
  inexécutabilité. Il ne consolide aucune preuve, ne gouverne aucune compatibilité et n’entre pas dans le
  profil `main` avant les PBI qui portent explicitement ces responsabilités.

### 2.19 — Rapport consolidé de parité déterministe, exacte et distributionnelle disponible

- consolider les preuves déterministes, de rejeu exact et de parité distributionnelle ;
- identifier précisément la fixture, la règle, la version et le moteur en défaut ;
- séparer échec fonctionnel, incompatibilité de version, divergence distributionnelle et erreur
  d’infrastructure ;
- publier un rapport JSON canonique et une synthèse Markdown.

### 2.20 — Dérives de version et décisions de compatibilité statistique bloquées

- rendre obligatoire la version du contrat pour toute preuve de rejeu ;
- détecter les changements affectant tirages, censures, percentiles, scores, labels, histogrammes ou réponse ;
- exiger une décision de compatibilité, une nouvelle version et la mise à jour du corpus ;
- documenter migration ou invalidation des caches et historiques concernés.

### 2.21 — Contrôles complets de parité et de compatibilité bloquants dans le profil `main`

- exécuter dans le profil `main` les contrôles déterministes, exacts, distributionnels et de compatibilité ;
- bloquer toute divergence normative, distributionnelle ou de version non acceptée ;
- conserver un diagnostic local actionnable ;
- interdire skip, retry, quarantaine ou exemption silencieuse.
