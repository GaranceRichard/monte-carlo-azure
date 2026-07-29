# Contrôle progressif de maintenabilité

## Règles contrôlées

Le contrôle `Scripts/check_maintainability.py` analyse les sources Python, JavaScript et TypeScript
déclarées dans `config/maintainability.json`. Il mesure les lignes non vides et la complexité cyclomatique
des fichiers et des fonctions. Les plafonds courants sont de 350 lignes non vides et 50 points de
complexité par fichier, puis de 50 lignes non vides et 15 points de complexité par fonction.

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

La gate n’écrit jamais la baseline. Une régénération est réservée à une évolution explicite des plafonds
ou à une amélioration validée ; elle ne doit jamais accepter une dette créée par le correctif en cours.
Exécuter depuis la racine :

```bash
python Scripts/check_maintainability.py --write-baseline
python Scripts/check_maintainability.py
git diff -- config/maintainability-baseline.json
```

Le diff doit être relu : origine de chaque ajout, baisse conservée pour chaque amélioration, stabilité des
plafonds et absence de suppression accidentelle. Lors d’un abaissement, une nouvelle entrée n’est légitime
que si sa mesure dépassait déjà le nouveau plafond avant le correctif ; toute dette touchée doit conserver
ou abaisser sa valeur antérieure. La baseline et les exceptions sont soumises aux mêmes tests et à la même
revue que le moteur ; aucune exception ni régénération automatique ne peut servir à obtenir un résultat vert.
