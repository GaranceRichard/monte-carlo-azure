# Contrôle progressif de maintenabilité

## Règles contrôlées

Le contrôle `Scripts/check_maintainability.py` analyse les sources Python, JavaScript et TypeScript
déclarées dans `config/maintainability.json`. Il mesure les lignes non vides et la complexité cyclomatique
des fichiers et des fonctions. Les plafonds courants sont respectivement de 500 et 80 pour les fichiers,
et de 80 et 15 pour les fonctions.

Le graphe des imports détecte les nouvelles composantes cycliques. Deux règles de direction seulement sont
appliquées, car elles découlent de la séparation frontend/backend décrite dans `ARCHITECTURE.md` : une
source sous `frontend/src` ne dépend pas de `backend`, et une source sous `backend` ne dépend pas de
`frontend/src`. Les directions internes entre métier, application, infrastructure et présentation ne sont
pas définies assez précisément dans l’architecture actuelle ; elles restent donc un inconnu documenté et
ne sont pas transformées en règles.

Tous les fichiers texte suivis par Git et déclarés par extension sont contrôlés pour détecter un nouvel
encodage UTF-8 invalide, un caractère de remplacement ou une séquence typique de mojibake. Les chemins
sont toujours enregistrés avec `/`, indépendamment du système d’exploitation.

Les exceptions sont déclarées dans `config/maintainability-exceptions.json`. Chaque exception indique son
type et les champs précis de la violation visée, avec un identifiant et une justification non vide. Une
exception sans justification rend le contrôle invalide ; aucune exception n’est codée dans le moteur.

## Principe de ratchet

`config/maintainability-baseline.json` est une photographie déterministe, triée et versionnée. Elle contient
uniquement les mesures qui dépassent déjà un plafond, les arêtes appartenant aux cycles existants, les
violations de direction existantes et les signatures de mojibake existantes. Une exécution réussit lorsque
chaque dette reste identique ou diminue. Elle échoue lorsqu’une mesure franchit un plafond, qu’une mesure
déjà enregistrée augmente, ou qu’un nouveau cycle, une nouvelle violation de direction ou un nouveau
mojibake apparaît.

Une amélioration n’exige pas de modifier immédiatement la baseline : la valeur observée peut rester sous la
valeur enregistrée. La prochaine mise à jour explicite abaisse alors le plafond propre à cette dette et
empêche son retour au niveau précédent.

## Dette existante et nouvelle dérive

La dette existante est exactement celle lisible dans la baseline. Elle ne bloque pas la chaîne qualité tant
qu’elle n’augmente pas. Une nouvelle dérive est une dette absente de la baseline, une nouvelle arête
cyclique, ou une valeur supérieure à celle qui y est enregistrée ; elle est bloquante. La baseline ne
constitue donc ni une cible d’architecture ni une autorisation d’aggraver les éléments qu’elle recense.

## Mise à jour explicite de la baseline

La gate n’écrit jamais la baseline. Après une amélioration validée, ou après une décision explicite et
revue d’accepter une dette nouvelle, exécuter depuis la racine :

```bash
python Scripts/check_maintainability.py --write-baseline
python Scripts/check_maintainability.py
git diff -- config/maintainability-baseline.json
```

Le diff doit être relu : origine de chaque ajout, baisse conservée pour chaque amélioration, stabilité des
plafonds et absence de suppression accidentelle. Une dérogation ponctuelle se déclare plutôt dans
`config/maintainability-exceptions.json` avec sa justification. La baseline et les exceptions sont ensuite
soumises aux mêmes tests et à la même revue que le moteur ; elles ne sont jamais régénérées automatiquement
par la gate pour obtenir un résultat vert.
