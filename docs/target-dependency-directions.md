# Décision d’architecture — Directions de dépendance cibles

## Statut et portée

- **Statut :** acceptée
- **Date :** 20 août 2026
- **Autorité :** ce document décide la direction des dépendances entre domaine, application, ports,
  adaptateurs, présentation et composition pour les deux runtimes du produit.

Cette décision guide les migrations architecturales et les nouveaux modules. Elle ne déplace aucun fichier,
ne définit pas la signature détaillée des futurs ports et ne change aucun comportement fonctionnel ou
statistique. Le [graphe factuel](dependency-graph.md) reste l’autorité de ce qui existe ; le présent document
est l’autorité de la direction recherchée.

Sa [projection machine versionnée](../config/dependency-authority-v1.0.json) matérialise exactement la matrice
et le vocabulaire ci-dessous pour les contrôles automatiques. Elle cite cette décision et son empreinte, et la
[documentation du format](dependency-authority.md) impose une évolution conjointe : le JSON est la projection
exécutable de la décision, jamais une décision concurrente ni une allowlist autonome.

Les règles s’appliquent aux dépendances runtime, aux imports de type, aux imports dynamiques, à l’héritage, à
l’instanciation et à toute exposition de type technique. Un flux de données peut aller du domaine jusqu’à
l’interface sans inverser la dépendance de code : l’extérieur appelle un port et reçoit une valeur définie par
ce contrat.

## Entrées factuelles de la décision

La décision confronte explicitement les deux baselines disponibles :

- le graphe réel contient 246 modules et 1 293 arêtes, dont 85 imports TypeScript de compilation ; il localise
  deux cycles impliquant au moins un import de type, deux contournements conventionnels de façade et huit
  arêtes de l’infrastructure qualité vers le produit ;
- le [registre des autorités](structured-data-authority-registry.md) attribue 23 données structurantes à 23
  autorités uniques et conserve 14 familles d’ambiguïtés, notamment les alias locaux, le typage structurel
  des DTO Azure DevOps, les validations recouvrantes, les modèles de restitution dispersés et les accès Mongo
  opératoires directs ;
- les garanties statistiques ont déjà une autorité normative, des contrats interlangages et des preuves
  bloquantes. Une réorganisation des dépendances ne peut ni redéfinir leurs formules ni affaiblir ces preuves.

Le nom d’un répertoire actuel ne suffit pas à lui attribuer une couche cible. La responsabilité réelle, le
propriétaire du contrat et la direction ci-dessous priment. L’affectation exhaustive des fichiers et les
frontières physiques seront décidées séparément.

## Couches et propriété

| Couche | Responsabilité cible | Ce qu’elle possède |
| --- | --- | --- |
| Domaine | Signification métier, invariants et transformations pures | Entités, Value Objects, erreurs métier, politiques et résultats métier |
| Application | Orchestration d’un cas d’usage sans choix technologique | Cas d’usage, séquence des appels, transactions logiques et résultats applicatifs |
| Ports | Contrats publics par lesquels l’extérieur appelle l’application ou l’application demande une capacité | Opérations entrantes et sortantes, commandes et résultats minimaux exprimés avec des valeurs internes |
| Adaptateurs | Traduction entre un port et une technologie ou un moteur concret | HTTP sortant, Azure DevOps, MongoDB, stockage navigateur, horloge, identité, moteur et leurs DTO techniques |
| Présentation | Traduction d’un résultat de port en information restituable et interaction avec un support | Modèles de présentation, mappers, React, DOM, PDF, CSV et protocoles HTTP entrants |
| Composition | Choix et assemblage des implémentations au point d’entrée | Configuration, factories, durée de vie et branchement des adaptateurs sur les ports |

Un port est possédé par le besoin intérieur qu’il protège, jamais par la technologie qui l’implémente. Un port
entrant expose un cas d’usage à la présentation ; un port sortant exprime une capacité demandée par
l’application. Une interface algorithmique strictement interne à une politique de domaine reste un contrat de
domaine, même si son nom historique contient `Port`. Le nom ne permet donc pas de contourner la matrice.

## Règle de direction

La direction générale est :

```text
présentation ──> ports <── application ──> domaine
                     ^
                     |
adaptateurs ─────────┘
       ^
       |
composition ──> présentation, adaptateurs, application, ports, domaine
```

Le schéma montre des dépendances de code et non le sens des requêtes ou réponses. La composition est une
couche extérieure prévue pour voir les concrétions ; elle ne transmet à un consommateur que le contrat du port
correspondant.

### Matrice normative

`Oui` signifie qu’une dépendance directe est permise sous réserve d’une API publique et de l’absence de cycle.
`Interne` signifie uniquement au sein du même module cohésif, jamais entre deux adaptateurs ou restitutions
indépendants. Toute autre cellule est interdite.

| Source \ Cible | Domaine | Application | Ports | Adaptateurs | Présentation | Composition |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Domaine | Interne | Non | Non | Non | Non | Non |
| Application | Oui | Interne | Oui | Non | Non | Non |
| Ports | Oui | Non | Interne | Non | Non | Non |
| Adaptateurs | Oui | Non | Oui | Interne | Non | Non |
| Présentation | Non | Non | Oui | Non | Interne | Non |
| Composition | Oui | Oui | Oui | Oui | Oui | Interne |

Les dépendances internes à une même couche restent dirigées et acycliques. Deux domaines, deux cas d’usage,
deux ports, deux adaptateurs, ou deux restitutions distincts ne deviennent pas un seul module parce qu’ils
partagent un répertoire.

## Dépendances autorisées

### Domaine

- Le domaine dépend de ses propres abstractions pures et des API publiques d’un autre module de domaine
  explicitement propriétaire de la sémantique utilisée.
- Il utilise seulement les primitives du langage et des bibliothèques algorithmiques pures dont aucun type ne
  franchit son API. Une bibliothèque qui impose un format de transport, de stockage, d’interface ou
  d’exécution appartient à un adaptateur.
- Une politique injectable nécessaire à un calcul purement métier peut être un contrat de domaine. Elle ne
  doit contenir aucun type technologique et ne donne pas au domaine accès à des effets d’infrastructure.

### Application et ports

- L’application orchestre le domaine et appelle les ports sortants. Elle peut implémenter explicitement un
  port entrant, mais la définition publique du port ne dépend jamais de l’implémentation applicative.
- Les ports dépendent seulement des valeurs de domaine et des autres types du même contrat cohésif. Ils
  n’importent ni framework, ni DTO technique, ni hook, route, store ou moteur concret.
- Les cas d’usage communiquent entre eux par une API applicative publique lorsque cette relation est
  nécessaire et acyclique. Ils ne partagent pas un module `common` sans propriétaire.

### Adaptateurs

- Un adaptateur dépend du port qu’il implémente ou consomme et des types de domaine nécessaires à son mappage.
- Ses DTO, clients, erreurs techniques et objets de bibliothèque restent privés. Une valeur sortante est
  convertie explicitement vers le contrat intérieur avant de franchir la frontière.
- Les modules internes d’un même adaptateur peuvent coopérer. Un adaptateur ne dépend jamais du code concret
  d’un autre adaptateur ; leur coopération passe par un port ou par la composition.
- Deux adaptateurs situés dans des processus différents peuvent échanger via un protocole versionné. Chacun
  dépend du contrat de transport, pas de l’implémentation de l’autre.

### Présentation

- React, les routes HTTP entrantes et les générateurs de rapport appellent des ports entrants. Ils ne
  construisent pas un service applicatif et n’importent pas un adaptateur sortant.
- Un mapper de présentation transforme fidèlement un résultat de port en modèle de présentation. Il peut
  choisir format, libellé ou disposition, mais ne recalcule pas une règle métier ou statistique.
- UI, PDF et CSV peuvent partager une API de modèles de présentation ; ils ne dépendent pas de leurs
  implémentations respectives et aucun rapport ne lit le DOM pour retrouver une donnée métier.

### Composition

- Le composition root est le seul lieu qui importe ensemble les implémentations applicatives, les adaptateurs
  et les points d’entrée de présentation afin de les brancher sur leurs ports.
- Il peut lire la configuration, choisir Cloud ou Server/TFS, HTTP ou local, MongoDB ou mémoire, puis gérer la
  durée de vie. Il ne valide pas un invariant métier, ne transforme pas un résultat et n’orchestre pas un cas
  d’usage.
- Il n’exporte pas de service locator ni d’adaptateur concret. Après assemblage, chaque consommateur ne voit
  que son port.

## Interdictions explicites

Les relations suivantes sont interdites, y compris lorsqu’elles n’existent qu’au niveau des types :

- domaine vers application, port applicatif, adaptateur, présentation, composition, framework ou DTO
  technique ;
- application vers adaptateur concret, présentation, composition, React, FastAPI, Pydantic, HTTP, MongoDB,
  Redis, Azure DevOps, navigateur, DOM ou stockage local ;
- port vers application concrète, adaptateur, présentation, composition ou type de bibliothèque technique ;
- adaptateur vers application concrète, présentation, composition ou autre adaptateur ;
- présentation vers domaine direct, application concrète, adaptateur sortant ou composition ;
- module produit vers l’infrastructure qualité ;
- import profond qui traverse une frontière de module déclarée au lieu de son API publique ;
- cycle direct ou indirect, même s’il contient uniquement un import de type sur une de ses arêtes ;
- copie d’une donnée structurante utilisée comme seconde autorité ou compatibilité structurelle implicite d’un
  DTO technique avec un modèle intérieur.

Il n’existe pas d’exception permanente ni de droit acquis pour le graphe actuel. Une contrainte réellement
incompatible avec cette décision exige une nouvelle décision d’architecture qui la remplace ou l’amende ; un
commentaire, une allowlist ou un import de type ne suffit pas.

## Cas limites issus du graphe et du registre

| Cas observé | Verdict cible | Conséquence pour une migration future |
| --- | --- | --- |
| `demoData.ts → usePortfolioReport → simulationForecastService → simulationForecastCore → demoData.ts` (`CYC-001`) | Non conforme. La branche de type participe au cycle comme une branche runtime. | La donnée de démonstration dépendra d’un contrat intérieur stable ; aucun contrat ne sera possédé par un hook consommateur. |
| `simulationForecastCore ↔ simulationForecastService` (`CYC-002`) | Non conforme, malgré l’arête retour limitée à la compilation. | Le contrat commun sera possédé par le domaine, l’application ou un port, puis consommé dans une seule direction. |
| `seededSampleIndexDrawPort.ts → domain/sampleIndexDrawPort.ts` | Direction conforme : un adaptateur technique dépend d’un contrat algorithmique intérieur. | Le mot `Port` ne décide pas sa couche ; le contrat reste de domaine s’il ne porte que la politique de tirage et des valeurs de domaine. |
| `simulationForecastCore.ts → api/simulationMappers.ts` | Non conforme à la cible : une orchestration intérieure connaît un détail de l’adaptateur HTTP. | L’application appellera un port moteur ; la composition choisira l’adaptateur HTTP ou local. |
| `useSimulationHistory.ts → storage/simulationHistoryMappers.ts` | Non conforme si le hook porte le cas d’usage : le consommateur connaît la concrétisation du stockage. | Le cycle de stockage passera par un port ; les DTO et migrations de format resteront dans l’adaptateur. |
| Import profond vers `api/` ou `storage/` alors qu’un fichier homonyme existe | Le nom homonyme seul ne crée pas une frontière. Dès qu’une API publique est déclarée, son contournement est interdit. | La décision des frontières physiques précisera l’API ; aucun des deux contournements recensés n’est acquis. |
| Composants React dépendant de hooks et de `SimulationContext` | Conforme seulement pour un état de présentation. Non conforme si le hook porte orchestration ou autorité métier. | La classification suit la responsabilité réelle ; un déplacement ou un renommage seul ne satisfait pas la décision. |
| `usePortfolioReport.ts` charge dynamiquement `portfolioPrintReport.ts` | Non conforme : l’orchestration applicative choisit un adaptateur de présentation. | Le rapport consommera un modèle de présentation depuis son point d’entrée ; l’application ignorera son existence. |
| Cinq imports de `statistical_corpus_runner.py` vers des modules backend internes | Non conformes à la cible de preuve indépendante. | Le runner consommera une API ou un port de preuve public sans importer un adaptateur backend interne. |
| Trois scripts frontend chargent des runners sous `frontend/src` | Conformes uniquement si ces runners sont des points d’entrée publics de preuve et ne révèlent aucun adaptateur interne. | La frontière de preuve devra être explicite ; le chemin de fichier actuel n’est pas une autorisation en soi. |
| Frontend HTTP et endpoint backend | Conforme si les deux côtés dépendent d’un protocole versionné et confinent leurs DTO. | Aucun côté n’importe l’implémentation de l’autre ; chaque mapper traduit explicitement entre transport et contrat intérieur. |

Le graphe classe tout `Scripts/` dans la zone qualité, mais la couche cible dépend de la responsabilité. Un
script de purge ou de scrub est un point d’entrée opératoire qui compose son propre adaptateur ; il n’obtient
pas pour autant le droit d’importer un autre adaptateur concret. Un outil de preuve reste, lui, dans un plan de
vérification séparé.

### Autorités et répétitions de forme

- Les alias de `AppStep`, runtime ou cible Azure DevOps observés par A-01 doivent dépendre de leur autorité
  publique ou être mappés à une frontière ; recopier l’union de valeurs est interdit.
- Les DTO Azure DevOps structurellement compatibles avec `NamedEntity` ou les observations delivery (A-02)
  ne franchissent pas la frontière par simple compatibilité TypeScript : un mapper explicite produit la valeur
  intérieure.
- Les formes Python, TypeScript et HTTP du résultat statistique (A-05/A-06) peuvent se répéter comme contrats
  de frontière et validateurs. Elles restent conformes si `STD-STAT-001` demeure l’unique autorité sémantique,
  si la transformation est explicite et si un validateur rejette une divergence sans recalculer une nouvelle
  vérité métier.
- Une version de stockage, une configuration portefeuille ou un nom de cookie répété (A-09/A-10/A-12) ne
  devient pas du code partagé neutre. Son autorité appartient à une couche ; les autres couches dépendent de
  son contrat public ou effectuent une transformation explicite.
- Les modèles équipe, portefeuille, UI et rapport (A-11) peuvent différer pour présenter. Ils ne peuvent ni
  devenir autorités des résultats statistiques ni dépendre de l’implémentation d’une autre restitution.
- Les documents Mongo et scripts opératoires (A-13/A-14) restent des représentations techniques. Une commande
  ou un résultat applicatif ne dépend jamais de leur forme, même lorsqu’un script possède son propre point de
  composition.

## Exemples

### Conformes

```text
présentation React → port entrant de prévision
application de prévision → domaine statistique + port sortant de moteur
adaptateur HTTP de simulation → port sortant + mapper DTO privé
adaptateur MongoDB → port de persistance + modèle de domaine public
composition frontend → cas d’usage + adaptateurs HTTP/local + présentation
```

Un moteur Python et un moteur TypeScript peuvent implémenter séparément le même contrat statistique. Cette
duplication interlangage est conforme parce qu’ils ne dépendent pas l’un de l’autre, restent contrôlés par la
même norme et le même corpus et n’exposent pas leurs types techniques par le port.

### Non conformes

```text
domaine → React, Pydantic, NumPy exposé, MongoDB ou DTO HTTP
cas d’usage → HttpSimulationAdapter ou SimulationStore
hook d’orchestration → mapper privé de stockage
adaptateur MongoDB → adaptateur mémoire
rapport PDF → composant React ou DOM pour relire un résultat
module produit → script de quality gate
module A → type de B → runtime de A
```

Un import de type non émis en JavaScript reste non conforme lorsqu’il inverse une responsabilité ou ferme un
cycle : il couple quand même la compilation et l’évolution des contrats.

## Justification pragmatique

Cette direction protège d’abord les raisons de changer les plus stables. Le domaine et les contrats des cas
d’usage évoluent pour des raisons métier ; les adaptateurs et restitutions évoluent avec les technologies. Les
faire dépendre vers l’intérieur rend un changement de React, MongoDB, Azure DevOps, HTTP ou moteur local
possible sans modifier le métier.

La décision ne demande pas une pureté abstraite coûteuse :

- elle autorise les adaptateurs à construire des valeurs de domaine directement, ce qui évite des couches de
  traduction sans responsabilité ;
- elle réserve l’assemblage transversal à un composition root assumé au lieu de masquer les concrétions dans
  des services locators ;
- elle traite les imports de type comme de vraies dépendances parce que les cycles observés démontrent leur
  coût de changement ;
- elle ne confond pas duplication de représentation aux frontières et duplication d’autorité ;
- elle n’impose ni arborescence finale, ni nombre de ports, ni migration groupée avant que les frontières et
  la séquence de migration soient décidées.

## Effet sur l’existant et garanties

Les relations non conformes citées ci-dessus constituent une baseline de migration, pas des exceptions. Ce
document n’autorise aucune correction opportuniste : chaque migration reste portée par son outcome dédié et
doit préserver un état publiable.

Les formules, seuils, modes, percentiles, censures, Risk Score, histogrammes, versions, corpus, preuves exactes
et distributionnelles et règles de compatibilité restent inchangés. Tout futur déplacement du cœur
statistique devra conserver les mêmes autorités et passer les mêmes contrôles bloquants.
