# AGENTS.md

## Principes permanents de développement

- Tout chantier part du dernier état pertinent de `origin/main`. Il utilise une branche et un worktree
  dédiés, créés hors du dépôt principal, et annonce explicitement le nom de la branche et le chemin du
  worktree au démarrage.
- Le hook `post-checkout` prépare physiquement le `.venv` propre à tout nouveau worktree et le synchronise
  avec `requirements.txt` avant le premier contrôle. Le Python système ne sert qu'à ce bootstrap ; le scope,
  le pré-push et toutes les validations locales utilisent ensuite l'interpréteur du `.venv`. Le pré-push
  revérifie cet état et bloque avant le plan canonique si l'environnement ne peut pas être rendu exploitable.
- Tout chantier suit comme autorités, dans leur domaine de compétence, les sources de gouvernance du produit
  désignées par la [carte documentaire](docs/README.md). Il respecte les gates, les standards de qualité, les
  contrôles architecturaux et les critères de publication du dépôt ; aucune garantie existante n'est
  affaiblie ni contournée pour obtenir un résultat vert.
- Le prompt et l'outcome demandé fixent strictement le périmètre du chantier. Toute extension qui n'est pas
  nécessaire à cet outcome est retirée avant les validations coûteuses.
- Pendant le développement, seuls les tests, lints ou typechecks ciblés et proportionnés au risque modifié
  sont exécutés. Ne pas relancer un contrôle inchangé ni produire de couverture, build, rapport ou preuve
  canonique avant que son résultat puisse changer une décision.
- `git commit` est un checkpoint technique local qui peut figer un état transitoire ; il n'implique ni
  validation, ni mise à jour artificielle du README, ni intention de publication. `git push` est le seul
  point d'engagement : il soumet l'état final à l'ensemble des garanties de qualité et de gouvernance avant
  tout transfert.
- Un chantier ne crée aucun junction, lien symbolique, mount point ou autre reparse point dans son worktree.

## Cycle de contribution

- Avant de coder, le PBI fixe un outcome unique et les chemins autorisés. La commande
  `.venv\Scripts\python.exe Scripts/quality_gate.py scope --base origin/main --allow <chemin> [...]` compare en une seule
  inspection les changements suivis et non suivis à ce périmètre. Un chemin inattendu bloque le travail ;
  une portée `massive` exige l'acquittement explicite `--allow-massive` avant de poursuivre.
- Une régénération n'est exécutée qu'après modification de son autorité source, une seule fois sur la tranche
  cohérente finale. Les inspections Git complètes sont limitées au contrôle de périmètre et à la préparation
  de la publication.
- Les compteurs d'exécution sont produits et revérifiés par l'agrégateur depuis les résultats natifs du run
  canonique. Ne pas rejouer les suites pour préfabriquer ces preuves ; seule la classification statique
  modifiée est régénérée avant le push. Les résultats courants sont archivés par la CI pour le SHA validé.
- Le premier état candidat est entièrement commité, resynchronisé sur `origin/main` et contrôlé une dernière
  fois par `scope`. Ne pas lancer la validation canonique séparément : le pré-push l'exécute une seule fois
  sur chaque SHA terminal réellement envoyé.
- Pour chaque plage introduisant de nouveaux commits, le pré-push exige que `README.md` racine existe dans
  l'état final et que son blob diffère de celui de chacune des bases de la plage. Ce contrôle peu coûteux
  précède le DAG ; la pertinence de la synthèse reste une exigence de revue, sans édition par checkpoint.
- Le pré-push scanne tous les commits introduits, valide le profil `main` complet, couvertures, E2E, preuves
  statistiques et smoke Docker inclus. La CI distante répète ces garanties parce qu'elle constitue une
  frontière de confiance indépendante, et non une preuve locale redondante.
- Le préflight des candidats pré-push sonde la disponibilité du moteur Docker avant les suites coûteuses.
  Une indisponibilité bloque immédiatement le candidat ; cette sonde ne remplace pas le smoke Docker
  complet, qui reste obligatoire dans la validation canonique.

## Intégration asynchrone

- Le premier PBI prêt s'intègre et se pousse immédiatement sur `main`, sans attendre les autres PBI.
- Avant de publier, un PBI retardataire se resynchronise sur le dernier `origin/main`, résout ses éventuels conflits et valide l'état final réellement destiné à `main`.
- La validation canonique du pré-push porte sur cet état final. Les vérifications partielles ne remplacent pas son verdict.
- Après confirmation du push, le PBI nettoie uniquement son propre worktree et sa propre branche.

## Hygiène locale et publication

- Un PBI est responsable uniquement des fichiers, répertoires temporaires et résidus qu'il crée.
- Les fichiers ignorés, temporaires ou résidus préexistants sans lien avec le PBI ne bloquent jamais la publication ni la DoD.
- Aucun scan récursif global du checkout principal n'est requis avant publication.
- Un problème de nettoyage local bloque la publication uniquement s'il a été créé par le PBI courant et compromet réellement son intégration.
- Un échec de nettoyage découvert après un push confirmé est signalé, mais ne remet pas en cause la publication déjà effectuée lorsqu'il n'affecte pas l'intégration.

## Publication

Avant le push, vérifier seulement que :

- le PBI est sur la branche attendue et son état Git destiné à `main` est maîtrisé ;
- le remote GitHub est présent ;
- le périmètre déclaré est toujours respecté et l'état candidat est entièrement commité.

Le `git push` lance alors la validation canonique avant tout transfert. Publier dès qu'elle est verte, sans
dépendre de l'avancement ou de l'hygiène locale des autres PBI.
