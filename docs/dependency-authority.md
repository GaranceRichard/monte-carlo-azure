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
et du schéma, les sources normatives vérifiées, les comptes structuraux et un verdict sans diagnostic. Elle
est régénérable ; elle n’est ni une décision ni une seconde autorité.

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

## Utilisation

Depuis la racine du dépôt :

```powershell
python Scripts/check_dependency_authority.py
```

La commande valide le manifeste puis compare la preuve committée à un rendu déterministe. Après une évolution
revue des décisions et du manifeste :

```powershell
python Scripts/check_dependency_authority.py --write-evidence
python Scripts/check_dependency_authority.py
```

Le parseur est aussi importable par les futures familles de règles via `load_dependency_authority()` et
`direction_policy(source, target)`. Aucune de ces familles n’est encore implémentée ici : le contrôle ne lit
pas les imports du produit, ne classe pas le code actuel, ne bloque aucune dépendance produit et n’est pas
encore intégré aux profils de gate. Ces responsabilités appartiennent aux PBI 7.11 à 7.17.

## Limites préservées

Cette livraison ne déplace ni ne renomme aucun module produit, ne crée aucun port, ne corrige aucun cycle et
ne modifie aucun comportement frontend ou backend. Les formules, seuils, corpus, protocoles, preuves et gates
statistiques restent strictement inchangés.
