# Autorité machine des dépendances cibles

## Rôle et chaîne d’autorité

Les décisions acceptées sur les [directions de dépendance](target-dependency-directions.md) et
l’[architecture cible](target-architecture.md) restent les autorités normatives : elles possèdent le sens,
les justifications, les cas limites et les conséquences architecturales. Le manifeste
[`config/dependency-authority-v1.0.json`](../config/dependency-authority-v1.0.json) est leur projection
exécutable unique. Il donne aux futurs contrôles une représentation versionnée et parsable de la matrice,
des couches, des runtimes et des frontières acceptées, sans réinterpréter ces décisions dans le code du
parseur.

Le manifeste cite obligatoirement les PBI 7.7 et 7.8, leurs chemins, leurs rôles et leurs empreintes SHA-256.
Le parseur refuse une décision absente, déplacée ou modifiée sans revue conjointe de sa projection. En sens
inverse, les deux décisions normatives renvoient au même manifeste. Une évolution d’architecture modifie donc
la décision concernée, le manifeste, son empreinte et les tests dans un même changement ; une allowlist ou une
valeur codée seulement dans un futur contrôle ne constitue jamais une nouvelle autorité.

```text
décisions normatives 7.7 + 7.8
            |
            v
config/dependency-authority-v1.0.json
            |
            +--> schéma structurel versionné
            +--> parseur et validation sémantique
            +--> preuve déterministe de validité
```

La [preuve versionnée](../reports/dependency-authority-validation.json) contient les empreintes du manifeste
et du schéma, les sources normatives vérifiées, les comptes structuraux, les inspections du domaine et des
API publiques, ainsi que le nombre d’arêtes entre modules gouvernés. Un verdict valide porte zéro diagnostic,
zéro dépendance technologique du domaine, zéro import profond et zéro cycle de module. La preuve est
régénérable ; elle n’est ni une décision ni une seconde autorité.

## Format 1.0.0

Le format JSON est fermé par
[`dependency-authority-v1.0.schema.json`](../config/dependency-authority-v1.0.schema.json), fondé sur JSON
Schema Draft 2020-12. Les propriétés inconnues et clés JSON dupliquées sont refusées. `schemaVersion` suit une
version sémantique ; le parseur courant accepte explicitement `1.0.0` et refuse toute autre version tant
qu’une migration de format n’est pas implémentée.

| Champ | Rôle |
| --- | --- |
| `schemaVersion`, `schema`, `authorityId` | Identité stable du contrat et de son schéma local |
| `projectionRole` | Déclare que le JSON projette les décisions normatives au lieu de les concurrencer |
| `normativeSources` | Lie exactement 7.7 et 7.8 par PBI, chemin, rôle et SHA-256 |
| `layers` | Déclare les six couches et leur responsabilité synthétique |
| `directions` | Matrice fermée de 36 couples ordonnés avec `allowed`, `forbidden` ou `internal-only` |
| `runtimes` | Déclare les racines frontend, backend et qualité acceptées par 7.8 |
| `boundaries` | Développe les patrons `{module}`, modules cibles et couche produit ou rôle qualité |
| `moduleEncapsulation` | Déclare les points d'entrée publics par langage et les seules exceptions exactes aux imports profonds |

`internal-only` s’applique uniquement à une couche vers elle-même. Il autorise la coopération dans un module
cohésif, sans autoriser les cycles ni transformer deux modules distincts en un seul. Le module `*` des ports
exprime la racine cible ouverte par capacité décidée en 7.8 ; il ne vaut pas exception à une future règle
d’encapsulation.

Les chemins sont relatifs au dépôt, utilisent `/` et finissent par `/`. Un patron contient exactement un
jeton `{module}` sous la racine de son runtime. Chaque chemin développé possède une seule déclaration. Les
runtimes produit couvrent exactement les six couches ; la qualité reste un système de preuve extérieur et
porte des rôles propres plutôt qu’une couche produit inventée.

## Parseur et diagnostics

[`Scripts/dependency_authority.py`](../Scripts/dependency_authority.py) charge le JSON en UTF-8, refuse les
clés dupliquées, applique le schéma puis construit un modèle seulement lorsque la validation sémantique est
verte. Les contrôles sémantiques couvrent :

- version de format supportée et liaison exacte aux décisions 7.7/7.8 ;
- présence et empreinte des documents normatifs ;
- unicité et complétude des six couches ;
- référence, unicité et complétude des 36 directions ;
- usage de `internal-only` limité à la diagonale ;
- identité des trois runtimes, propriété couche/rôle et couverture des couches produit ;
- ancrage, développement et absence de doublon des frontières.

Chaque défaut suit le format suivant :

```text
<fichier>:<pointeur JSON ou ligne/colonne>: [DEP-AUTH-…] <constat>. Correction: <action attendue>
```

Exemples de localisations : `/directions/12/to`, `/runtimes/1/boundaries/3/pathPattern` ou
`line 8, column 17`. Les codes distinguent lecture, syntaxe, structure, version, sources, matrice, runtimes,
frontières et fraîcheur de la preuve. Le diagnostic désigne la valeur à corriger et ne masque pas les autres
erreurs sémantiques qui peuvent être calculées sans risque.

## Règle 7.11 — indépendance technologique du domaine

Le même contrôle développe les préfixes des frontières `domain` et `adapters` depuis le manifeste, puis
inspecte les sources de production TypeScript/JavaScript et Python sous les familles de domaine frontend et
backend. Les fichiers de test colocalisés (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/`) relèvent de
la qualité et ne sont pas classés comme code produit. Les imports TypeScript statiques, réexports, imports de
type, `import()` et `require()` sont examinés ; Python est analysé par son AST, y compris les imports placés
sous `TYPE_CHECKING`.

| Dépendance observée depuis le domaine | Verdict de la règle 7.11 |
| --- | --- |
| Primitive du langage ou module de la bibliothèque standard Python | Autorisée |
| Source projet non technique et hors famille `adapters` | Non refusée par 7.11 ; les directions inter-modules relèvent des contrôles dédiés ultérieurs |
| Chemin résolu sous une famille `adapters`, ou spécificateur visant explicitement `adapters` | Interdite, y compris pour un type ou un chargement dynamique |
| Package npm ou Python externe | Interdit par défaut comme choix technologique |
| Ressource importée `.css`, `.json`, `.svg`, `.html`, `.xml`, `.yaml`, `.yml`, `.csv` ou `.pdf` | Interdite comme format ou support technique |
| Import relatif non résolu | Non déclaré conforme ; laissé aux contrôles d’encapsulation et de résolution hors 7.11 |

Une bibliothèque algorithmique tierce ne reçoit pas d’exception locale : son éventuelle pureté doit être
revue et projetée dans une évolution versionnée de l’autorité avant de pouvoir être acceptée. Il n’existe ni
commentaire d’ignorance, ni allowlist cachée dans le scanner.

Une violation est localisée au fichier et à la ligne :

```text
frontend/src/domain/simulation/forecast.ts:line 2: [DEP-DOMAIN-ADAPTER] ... Correction: ...
backend/domain/simulation/value.py:line 1: [DEP-DOMAIN-TECHNOLOGY] ... Correction: ...
```

`DEP-DOMAIN-ADAPTER` demande d’inverser la dépendance par une abstraction pure et une injection depuis la
composition. `DEP-DOMAIN-TECHNOLOGY` demande de déplacer package ou ressource vers un adaptateur.
`DEP-DOMAIN-PARSE` et `DEP-DOMAIN-SCAN` ferment le contrôle si une source ou le dépôt ne peut pas être
inspecté de façon fiable.

## Règle 7.12 — encapsulation par les API publiques

Chaque répertoire de module développé depuis les frontières du manifeste est gouverné dès qu'il contient
une source de production. Une API TypeScript/JavaScript est exposée par un point d'entrée `index.*` à la
racine du module ; une API Python est exposée par `__init__.py`. Un import depuis le module lui-même peut
atteindre ses internes. Tout autre consommateur doit cibler ce point d'entrée racine.

Le contrôle réutilise la même extraction que 7.11 pour les imports statiques, les réexports, les imports de
type, `import()`, `require()` et l'AST Python, y compris sous `TYPE_CHECKING`. Les chemins relatifs non
résolus qui visent quand même l'intérieur d'une frontière échouent fermés. Les commentaires et chaînes ne
créent aucune dépendance. Un test colocalisé dans le module peut exercer ses internes parce qu'il reste dans
la même frontière ; un consommateur extérieur gouverné utilise l'API publique.

Une violation produit un diagnostic actionnable :

```text
frontend/src/application/client.ts:line 4: [DEP-PUBLIC-API-DEEP-IMPORT] ... Correction: importer depuis la frontière attendue 'frontend/src/domain/delivery/' (...)
```

`DEP-PUBLIC-API-MISSING` localise aussi le premier fichier de production d'un module qui ne publie aucun
point d'entrée. `DEP-PUBLIC-API-PARSE` et `DEP-PUBLIC-API-SCAN` ferment le contrôle si les imports ne peuvent
pas être inspectés de façon fiable.

Les exceptions ne sont ni des globs ni des commentaires d'ignorance. Chaque entrée de
`moduleEncapsulation.deepImportExceptions` nomme un fichier source et un fichier cible exacts, une
`authorization` revue et une raison. Elle n'autorise aucun voisin, autre consommateur ou autre interne.
L'autorité livrée ne déclare actuellement aucune exception.

## Règle 7.13 — acyclicité des modules gouvernés

Le graphe d’acyclicité prend pour nœuds les frontières déclarées par `runtimes[].boundaries` qui contiennent
réellement une source de production. Une arête relie deux nœuds lorsqu’une source de production du premier
importe une source du second. Les imports internes au même module ne créent donc pas de boucle artificielle,
et les fichiers de test ne créent aucune arête produit. Les imports statiques, réexports, imports de type,
`import()`, `require()` et imports Python, y compris sous `TYPE_CHECKING`, participent tous au graphe.

Le contrôle refuse les cycles directs `A -> B -> A` et indirects `A -> B -> ... -> A`. Le chemin est fermé,
canonique et accompagné du fichier, de la ligne, du spécificateur et de la phase de chaque arête :

```text
frontend/src/domain/delivery/index.ts:line 1: [DEP-MODULE-CYCLE] Le graphe des modules gouvernés contient le cycle frontend/src/domain/delivery/ -> frontend/src/domain/simulation/ -> frontend/src/domain/delivery/. Dépendances: ... Correction: rompre une dépendance du chemin (...)
```

`DEP-MODULE-CYCLE-PARSE` et `DEP-MODULE-CYCLE-SCAN` ferment le contrôle lorsqu’une source Python ou une
racine gouvernée ne peut pas être inspectée complètement. Il n’existe ni exception de cycle, ni commentaire
d’ignorance, ni droit acquis pour un import de type.

La preuve courante porte sept modules gouvernés, quatre arêtes inter-modules de production et zéro cycle. Le
module `frontend/src/application/team-forecast/` déclare `index.ts` comme API publique ; les hooks de simulation
et de portefeuille le consomment par cette frontière. Les deux composantes cycliques factuelles `CYC-001` et
`CYC-002` ont disparu du [graphe observé](dependency-graph.md#cycles-localisés) avec le retrait des anciennes
façades `simulationForecastService.ts` et `simulationForecastCore.ts`. La baseline de maintenabilité ne
conserve aucune dette cyclique : toute réintroduction devient une nouvelle dérive bloquante.

## Utilisation

Depuis la racine du dépôt :

```powershell
python Scripts/check_dependency_authority.py
```

La commande valide le manifeste et les trois familles de règles intégrées, puis compare la preuve committée
à un rendu déterministe. Après une évolution revue du contrôle, des décisions ou du manifeste :

```powershell
python Scripts/check_dependency_authority.py --write-evidence
python Scripts/check_dependency_authority.py
```

Le parseur reste importable par les familles de règles via `load_dependency_authority()` et
`direction_policy(source, target)`. Depuis 7.11 à 7.13, le contrôle bloque les technologies dans le domaine,
les contournements des API publiques et les cycles entre modules gouvernés. Il n’est pas encore intégré aux
profils de gate : cette responsabilité appartient au PBI 7.17.

## Limites préservées

Le contrôle 7.13, pris isolément, ne traitait ni indépendance entre adaptateurs (7.14), ni confinement des DTO
(7.15), ni direction des modules partagés (7.16), ni branchement du contrôle aux profils de gate (7.17). Le
PBI 7.19 ajoute la frontière applicative de prévision et migre les deux cycles frontend recensés sans modifier
le contenu fonctionnel des API ni les formules, seuils, corpus ou protocoles statistiques. L’autorité
`resolved-defaults` est réattachée par une release compatible et ses preuves obligatoires sont régénérées.
