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

Implémentation retenue :

- le port Python demande des matrices d’indices afin de préserver la vectorisation et les lots existants ;
- le port TypeScript demande un indice unitaire afin de préserver l’ordre historique des simulations
  locales et du bootstrap portefeuille ;
- les adaptateurs concrets conservent respectivement `numpy.random.default_rng(seed)` et Mulberry32,
  tandis que les services et hooks restent les seuls lieux de composition ;
- le PRNG commun et ses vecteurs relèvent toujours du PBI 2.7 ; l’ordre logique commun et l’indépendance
  contractuelle du batching relèvent toujours du PBI 2.8.

### Résultat attendu du PBI 2.7

- implémenter le même PRNG contractuel dans les deux langages ;
- définir son état, son domaine, sa sortie et ses vecteurs de vérification ;
- prouver l’égalité des suites de nombres produites ;
- ne pas aligner dans ce PBI les percentiles, la fiabilité ou les histogrammes.

### Résultat attendu du PBI 2.8

- figer l’ordre logique de consommation des tirages ;
- rendre les résultats indépendants du découpage en lots ;
- couvrir les deux modes, les censures et les changements de taille de batch ;
- ne pas introduire le corpus complet de parité.

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
