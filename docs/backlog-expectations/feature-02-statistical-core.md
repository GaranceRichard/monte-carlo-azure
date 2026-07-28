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

### Résultat attendu du PBI 2.10

- couvrir bornes, types invalides, traitement des zéros et paramètres actifs ;
- couvrir les deux modes, la fin exacte à l’horizon, les censures totale et partielle ;
- couvrir l’identifiabilité et l’ordre de P50, P70 et P90 ;
- utiliser des cas lisibles et déterministes, sans dépendre d’un moteur comme oracle.

### Résultat attendu du PBI 2.11

- couvrir le calcul et l’absence du Risk Score ;
- couvrir les seuils exacts de fiabilité après arrondi normatif ;
- couvrir histogrammes exacts et agrégés, masse et représentants ;
- inclure les cas qui matérialisent les divergences historiques recensées par l’audit.

### Résultat attendu du PBI 2.12

- fournir un runner Python et un runner TypeScript du même corpus ;
- produire des sorties canoniques comparables ;
- distinguer échec de schéma, échec moteur et divergence de résultat ;
- ne rendre aucun contrôle bloquant dans ce PBI.

## Phase C — Alignement statistique : PBI 2.13 à 2.17

### Résultat attendu du PBI 2.13

- aligner validations, paramètres actifs, valeurs absentes et forme normative de réponse ;
- conserver les DTO et persistances comme frontières primitives ;
- éviter toute coercion ou valeur sentinelle divergente ;
- ne modifier aucune formule statistique relevant des PBI suivants.

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
