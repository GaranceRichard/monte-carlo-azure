# Feature 2 — Garantir la fiabilité du cœur statistique

**Description :** formaliser les règles statistiques communes, supprimer les divergences involontaires entre Python et TypeScript et protéger les invariants du moteur par des contrats, un rejeu déterministe et des références partagées.

**Flux de valeur :** assurer que les projections, diagnostics et décisions reposent sur des calculs cohérents, reproductibles et explicables, quel que soit le chemin d’exécution utilisé.

**Backlog :** [`../backlog.md`](../backlog.md)

## Phase A — Déterminisme d’exécution : PBI 2.5 à 2.8

### Résultat attendu du PBI 2.5

- résoudre la seed aux frontières API, UI et démo avant l’appel du moteur ;
- conserver exactement une seed uint32 déjà validée ;
- supprimer les générations ou normalisations silencieuses dans le cœur ;
- ne pas injecter ici l’horloge ou les identifiants techniques sans effet statistique.

### Résultat attendu du PBI 2.6

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

### Résultat attendu du PBI 2.7

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

### Résultat attendu du PBI 2.8

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

### Résultat attendu du PBI 2.9

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

### Résultat attendu du PBI 2.10

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

### Résultat attendu du PBI 2.11

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

### Résultat attendu du PBI 2.12

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
  pas inclus dans le profil `main`; leur promotion en gate relève toujours du PBI 2.19 ;
- treize cas sont conformes dans les deux moteurs. Les deux cas d’histogramme agrégé exposent les écarts
  historiques attendus : Python `100` buckets contre TypeScript `51` centres impairs sur `0..100`, puis
  `50/9951` contre `51/10050` sur la plage discontinue, la norme demandant `50/9999` ;
- aucune divergence n’est corrigée, aucun moteur ou contrat externe n’est modifié et les alignements restent
  affectés aux PBI 2.13 à 2.17.

## Phase C — Alignement statistique : PBI 2.13 à 2.17

### Résultat attendu du PBI 2.13

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
  divergences d’histogrammes restent visibles et la parité reste informative jusqu’au PBI 2.19.

### Résultat attendu du PBI 2.14

- aligner les règles de censure ;
- aligner les rangs et quantiles de P50, P70 et P90 ;
- aligner le Risk Score et son arrondi d’autorité ;
- préserver les percentiles absents sans reconstruction depuis l’histogramme.

### Résultat attendu du PBI 2.15

- aligner moyenne, variance de population, quartiles et pente ;
- appliquer l’arrondi `round half up` avant les seuils ;
- appliquer exactement l’ordre de catégorisation normatif ;
- prouver les cas limites, notamment six et sept observations.

### Résultat attendu du PBI 2.16

- remplacer les constructions historiques divergentes par l’algorithme normatif ;
- appliquer `right = min(max, left + width - 1)` ;
- appliquer `x = floor((left + right) / 2)` ;
- garantir au plus 100 buckets, la masse et les représentants attendus ;
- invalider ou migrer explicitement toute référence historique devenue incompatible.

### Résultat attendu du PBI 2.17

- démontrer l’égalité exacte des résultats normatifs à entrée, seed et version identiques ;
- couvrir les deux modes, censures, percentiles, score, fiabilité et histogrammes ;
- vérifier plusieurs tailles de batch ;
- produire une preuve distincte de la seule équivalence distributionnelle.

## Phase D — Gouvernance de la parité : PBI 2.18 à 2.20

### Résultat attendu du PBI 2.18

- consolider les résultats déterministes, de rejeu et distributionnels ;
- identifier précisément la fixture, la règle et le moteur en défaut ;
- séparer échec fonctionnel, incompatibilité de version et erreur d’infrastructure ;
- publier un rapport JSON canonique et une synthèse Markdown.

### Résultat attendu du PBI 2.19

- exécuter les contrôles de parité dans le profil `main` ;
- bloquer toute divergence normative ;
- conserver un diagnostic local actionnable ;
- interdire skip, retry, quarantaine ou exemption silencieuse.

### Résultat attendu du PBI 2.20

- rendre obligatoire la version du contrat pour toute preuve de rejeu ;
- détecter les changements affectant tirages, censures, percentiles, scores, labels, histogrammes ou réponse ;
- exiger une décision de compatibilité, une nouvelle version et la mise à jour du corpus ;
- documenter migration ou invalidation des caches et historiques concernés.
