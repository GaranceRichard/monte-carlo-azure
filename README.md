# Monte Carlo Azure

[![CI](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml/badge.svg)](https://github.com/GaranceRichard/monte-carlo-azure/actions/workflows/ci.yml)

Monte Carlo Azure aide les responsables de delivery et de portefeuille à décider sous incertitude à partir
du throughput réellement observé dans Azure DevOps. Le produit transforme cet historique en projections
probabilistes pour arbitrer une date, une capacité ou un périmètre, sans exposer le PAT Azure DevOps au
backend.

[Essayer la démo publique](https://garancerichard.github.io/monte-carlo-azure/) ·
[Comprendre la vision produit](PRODUCT.md) ·
[Parcourir toute la documentation](docs/README.md)

## Le problème

Les décisions de planification reposent souvent sur des estimations subjectives, des moyennes peu
explicites ou des engagements calendaires présentés comme certains. Cela rend tardifs les arbitrages de
périmètre et de capacité, puis fragilise la crédibilité de la décision lorsque la variabilité réelle
réapparaît.

Monte Carlo Azure utilise l’historique de throughput pour rendre cette variabilité visible. Il ne prédit pas
un résultat certain : il montre une distribution, des niveaux de confiance et les limites des données qui
soutiennent la décision.

## Pour qui

Le produit s’adresse en priorité aux :

- directeurs de projet et responsables delivery qui doivent sécuriser une date ou un périmètre ;
- PMO qui préparent et expliquent des arbitrages en comité ;
- responsables portefeuille qui comparent plusieurs équipes ou hypothèses d’agrégation ;
- directions programme ou transformation qui veulent distinguer faits observés, incertitude et décision.

## Valeur apportée

Monte Carlo Azure permet de :

- répondre à « en combien de semaines ce backlog peut-il être terminé ? » ;
- répondre à « combien d’items peut-on livrer dans cet horizon ? » ;
- lire une projection médiane et une projection prudente sans masquer les non-terminaisons ;
- distinguer qualité des données, incertitude de prévision et recommandation d’arbitrage ;
- comparer plusieurs hypothèses portefeuille sans présenter l’une d’elles comme vraie sans preuve ;
- exporter une information cohérente pour la revue de pilotage.

[`PRODUCT.md`](PRODUCT.md) fait autorité pour le positionnement, les cas d’usage, la valeur et la vision.

## Capacités disponibles

### Prévision d’une équipe

- connexion directe à Azure DevOps Cloud ou Azure DevOps Server/TFS depuis le navigateur ;
- sélection de l’organisation, du projet et de l’équipe ;
- deux modes de simulation :
  - `backlog_to_weeks` pour projeter un délai à partir d’un backlog restant ;
  - `weeks_to_items` pour projeter une capacité à partir d’un horizon ;
- percentiles, distribution, `Risk Score` et diagnostic décisionnel ;
- traitement explicite des simulations censurées à l’horizon en mode backlog ;
- seed optionnelle pour rejouer une simulation avec la version courante du moteur et du contrat aléatoire ;
- export CSV du throughput et rapport PDF directement téléchargeable ;
- historique local contextualisé par équipe et historique backend statistique minimisé.

### Lecture portefeuille

- sélection de plusieurs équipes ;
- comparaison de quatre hypothèses : `Indépendant`, `Arrimé`, `Friction` et `Historique corrélé` ;
- séparation entre qualité des historiques, stabilité du résultat simulé et crédibilité de l’hypothèse ;
- référence de pilotage facultative, distincte d’une recommandation fondée sur les preuves ;
- rapport PDF consolidé avec synthèse, comparaison des hypothèses et détails des scénarios ;
- progression visible et tolérance aux échecs partiels pendant la génération du rapport.

### Découverte sans configuration

La démo GitHub Pages permet d’explorer les parcours équipe et portefeuille avec des données préparées, sans
PAT ni backend actif. Les écrans concernés portent un badge `Démo` afin de ne pas confondre ce parcours avec
une connexion Azure DevOps réelle.

## Garanties produit

- **Frontière d’identité stricte.** Le PAT, l’URL du serveur, l’organisation, le projet, l’équipe et
  l’historique Azure DevOps détaillé restent dans le navigateur. Le backend reçoit uniquement le throughput
  minimisé, les paramètres de simulation et un identifiant client pseudonyme indépendant d’Azure DevOps.
- **Incertitude conservée.** Une simulation backlog qui ne termine pas à l’horizon reste une censure ; elle
  n’est pas transformée en fausse durée. Un percentile non identifiable reste absent.
- **Sens métier cohérent.** Les percentiles prudents ne se lisent pas dans le même sens pour un délai et
  pour une capacité. L’interface et les exports consomment les résultats normatifs sans leur attribuer un
  autre sens.
- **Diagnostics séparés.** Le `Risk Score` exprime une dispersion entre percentiles. Il n’est ni une mesure
  de qualité des données, ni une recommandation automatique.
- **Fiabilité explicable.** La dispersion, les quartiles et la tendance du throughput suivent les mêmes
  formules dans les deux moteurs ; les seuils utilisent les métriques arrondies avant d’attribuer les labels
  `non fiable`, `fragile`, `incertain` ou `fiable`.
- **Rejeu exact vérifié.** À entrée normalisée, seed, version de contrat et configuration identiques, les
  moteurs Python et TypeScript produisent exactement la même réponse canonique. Le résultat backend reste
  indépendant du découpage en lots pour les configurations couvertes par la
  [preuve de rejeu versionnée](reports/statistical-exact-replay-evidence.json). Cette garantie reste liée
  aux versions déclarées du moteur, du contrat statistique et du contrat aléatoire.
- **Compatibilité explicite.** La rejouabilité et l’interprétation des résultats sont liées à des versions
  déclarées ; toute évolution incompatible exige une décision documentée de migration ou d’invalidation.
- **Validation distributionnelle distincte.** Des cohorts reproductibles de seeds différentes comparent
  aussi les lois de sortie, les censures et la disponibilité des indicateurs ; cette preuve statistique
  symétrique complète le rejeu exact sans le remplacer et reste distincte du backtesting sur données réelles.
- **État consolidé vérifiable et bloquant.** Un [rapport consolidé](reports/statistical-consolidated-report.md)
  réunit les garanties normatives, exactes, de batching et distributionnelles tout en conservant leurs
  périmètres, limites et versions. Le profil `main` le génère à partir des preuves du snapshot courant,
  puis le valide indépendamment avec leurs empreintes. L’identité du snapshot porte uniquement sur les
  sources et configurations autoritaires ; les rapports, couvertures, builds, caches, attestations et
  calibrations générés pendant la validation en sont exclus. Un rapport issu d’un autre contenu, d’un autre
  snapshot ou de preuves devenues périmées bloque la publication.
- **Évolution par outcomes.** Les garanties statistiques bloquantes étant établies, la priorité suivante est
  de réduire le coût de changement. Chaque unité de backlog livre un état architectural cohérent et publiable,
  avec les migrations, tests et retraits locaux nécessaires, vers des frontières métier, applicatives,
  techniques, de présentation et de qualité explicites.
- **Dépendances observables.** Le [graphe factuel](docs/dependency-graph.md) sépare les imports runtime et de
  type, localise les cycles et inventorie les imports profonds sans les corriger. Son
  [rapport JSON](reports/dependency-graph.json) est régénérable depuis les imports et points d’entrée visibles
  par Git ; les conventions de façade y restent explicitement distinctes des observations.
- **Coût de changement mesurable.** Une [baseline reproductible](docs/change-cost-baseline.md) relie trois
  évolutions représentatives à leurs fichiers, couches et dépendances. Les hotspots ne sont retenus qu’après
  combinaison de signaux mesurés de traversée, couplage et taille ; la preuve JSON reste descriptive et
  n’autorise ni migration ni réduction des garanties statistiques ou qualité.
- **Semaines comparables.** Le throughput historique utilise des semaines ISO complètes, du lundi au
  dimanche. La semaine courante n’est jamais injectée partiellement dans la simulation.

Les formules, bornes, formes de réponse et règles de compatibilité ne sont pas redéfinies ici. Elles relèvent
du [standard statistique](docs/standards/STD-STAT-001.md), du
[contrat du corpus](docs/statistical-reference-corpus.md) et de
[l’architecture](ARCHITECTURE.md).

## Limites à connaître

- le produit actuel réalise une simulation ponctuelle à partir des données disponibles au moment du calcul ;
  l’audit rétrospectif et la calibration dans le temps sont une orientation future, pas une capacité livrée ;
- le monitoring continu, la collecte permanente et les alertes en temps réel sont hors cible actuelle ;
- la qualité d’une projection dépend de la profondeur, de la complétude et de la représentativité de
  l’historique Azure DevOps ;
- les scénarios portefeuille sont des hypothèses d’agrégation : ils ne prouvent ni causalité, ni
  substituabilité des équipes, ni validité future ;
- lorsque les preuves sont insuffisantes, l’absence de scénario recommandé est un résultat valide ;
- les seize cas du corpus statistique courant concordent exactement et le protocole multi-seeds conclut à
  la parité distributionnelle sur ses scénarios ; la gate vérifie cette conformité déclarée, sans garantir
  l’exactitude future sur toute donnée Azure DevOps ;
- les preuves existantes ne remplacent pas un backtesting empirique, des tests sur de vrais tenants Azure
  DevOps, une matrice multi-navigateurs ou une baseline de charge.

L’état détaillé des risques et des preuves se trouve dans la
[matrice risques–contrôles](docs/risk-control-matrix.md) et le
[état consolidé des garanties statistiques](reports/statistical-consolidated-report.md). La trajectoire future est décrite
dans la [roadmap](docs/roadmap.md), sans promesse de calendrier.

## Utiliser le produit

### 1. Découvrir la démo

Ouvrir la [démo publique](https://garancerichard.github.io/monte-carlo-azure/), puis choisir :

- `Simulation` pour examiner une équipe ;
- `Portefeuille` pour comparer plusieurs équipes et produire un rapport consolidé.

### 2. Préparer une utilisation réelle

Prévoir :

- un navigateur compatible ;
- un accès Azure DevOps Cloud ou Server/TFS ;
- un PAT conservé dans le navigateur ;
- un historique contenant au moins six semaines exploitables ;
- un backend Monte Carlo accessible pour le mode connecté.

Le parcours est : connexion, organisation, projet, équipe, période, filtres, question de simulation, puis
lecture du résultat. Pour Azure DevOps Server/TFS, l’URL attendue inclut la collection, par exemple
`https://ado.monentreprise.local/tfs/DefaultCollection`.

### 3. Lire le résultat

Commencer par la qualité des données et les éventuelles censures, puis lire :

- en mode délai, une valeur plus haute représente une durée plus longue ;
- en mode capacité, une valeur prudente représente moins d’items ;
- le `Risk Score` complète cette lecture sans remplacer le diagnostic ni l’arbitrage humain ;
- une valeur absente ne doit pas être interprétée comme zéro.

Le détail des parcours Cloud et Server/TFS se trouve dans le
[guide frontend](frontend/README.md).

## Lancer localement

### Avec Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
curl -sS http://127.0.0.1:8000/health
```

L’application est alors disponible sur `http://127.0.0.1:8000`. La configuration de production, MongoDB,
Redis, la purge et les contrôles d’exploitation sont documentés dans
[`docs/deployment.md`](docs/deployment.md).

### En développement sous Windows

```powershell
.\start-dev.ps1 -ThreeTerminals
```

Dans VS Code, `Ctrl+Shift+B` lance également la tâche par défaut `Dev: 5 terminaux`.

Installation manuelle :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm --prefix frontend install
```

Puis lancer le backend et le frontend :

```powershell
python run_app.py
npm --prefix frontend run dev
```

Le backend écoute par défaut sur `http://127.0.0.1:8000` et le frontend sur
`http://localhost:5173`.

## Parcours de lecture

### Comprendre le produit

- [Vision, positionnement, cas d’usage et valeur](PRODUCT.md)
- [Trajectoire produit](docs/roadmap.md)
- [Capacités et contraintes propres au frontend](frontend/README.md)

### Comprendre les garanties

- [Architecture, sécurité et API](ARCHITECTURE.md)
- [Cartographie factuelle des responsabilités et flux frontend](docs/frontend-responsibilities-map.md)
- [Cartographie factuelle des responsabilités backend et du cycle de vie des données](docs/backend-responsibilities-map.md)
- [Graphe factuel des dépendances](docs/dependency-graph.md)
- [Standard statistique](docs/standards/STD-STAT-001.md)
- [Corpus de référence statistique](docs/statistical-reference-corpus.md)
- [Matrice risques–contrôles](docs/risk-control-matrix.md)

### Contribuer et valider

- [Carte complète de la documentation](docs/README.md)
- [Cartographie des responsabilités de l’infrastructure qualité](docs/quality-infrastructure-responsibilities-map.md)
- [Definition of Done](docs/definition-of-done.md)
- [Chemins critiques](docs/critical-paths.md)
- [Traçabilité Vitals](docs/vitals-traceability.md)
- [Carte machine des couvertures Vitals](docs/vitals-coverage-map.json)
- [Contrôle de maintenabilité](docs/maintainability.md)
- [Modèle de classification des tests](docs/test-classification.md)
- [Standard de test](docs/standards/STD-TEST-001.md)

Les worktrees de développement sont créés hors du dépôt principal et doivent rester entièrement supprimables
par `git worktree remove`. Aucun reparse point Windows — notamment junction ou lien symbolique — n’est admis
dans un worktree : `.venv`, `frontend/node_modules` et les autres dépendances y sont installés physiquement si
nécessaire, ou les outils partagés sont invoqués directement sans lien filesystem. Avant publication, vérifier
l’absence de reparse point et de résidu temporaire bloquant conformément à [`AGENTS.md`](AGENTS.md).

La validation complète est la tâche VS Code `Validation : profil main`, qui exécute :

```powershell
.\.venv\Scripts\python.exe Scripts/quality_gate.py ci --profile main
```

Le profil rapide valide exclusivement le snapshot construit depuis l’index Git. Lorsqu’un contrôle déclaré
dépend de l’outillage frontend, la gate expose temporairement le seul `frontend/node_modules` de
l’installation hôte dans ce snapshot, y compris si aucune suite frontend n’est sélectionnée. Les sources
restent celles du snapshot, le lien est partagé puis nettoyé après succès, échec ou interruption, et
l’absence des dépendances hôtes provoque un échec explicite.

Une validation ciblée ne vaut pas validation complète. Les règles de couverture, de conformité DoD et de
publiabilité restent définies dans [`docs/definition-of-done.md`](docs/definition-of-done.md).

### Piloter les outcomes futurs

- [Registre du backlog](docs/backlog.md)
- [Gouvernance du backlog](docs/backlog-governance.md)
- [Attendus détaillés](docs/backlog-expectations/README.md)

Le backlog recense les résultats observables et distingue ceux réalisés de ceux à venir. Sa colonne
`Réalisé le` est l’autorité de statut ; le README ne reproduit ni le prochain item, ni les dates, ni les
compteurs.
Une Feature conforme se réalise progressivement : seuls ses éléments achevés sont datés, après leurs prédécesseurs ;
aucune date n’est admise tant que la Feature reste à raffiner.

### Lire l’historique et les preuves

- [Changelog](CHANGELOG.md)
- [Audit historique de parité](docs/statistical-parity-audit.md)
- [Rapport de parité statistique](reports/statistical-parity-report.md)
- [État consolidé des garanties statistiques](reports/statistical-consolidated-report.md)
- [Rapport consolidé de stratégie de test](reports/test-strategy-report.md)

## Licence

Monte Carlo Azure est distribué sous [Apache License 2.0](LICENSE).

Le projet a été initialement conçu et développé par **Garance Richard**. Les informations d’attribution
sont précisées dans [`NOTICE`](NOTICE).
