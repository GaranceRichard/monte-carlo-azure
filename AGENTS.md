# AGENTS.md

## Principes

- Chaque PBI parallèle utilise une branche et un worktree dédiés.
- Le worktree d'un PBI est créé hors du dépôt principal.
- Un PBI ne crée aucun junction, lien symbolique, mount point ou autre reparse point dans son worktree.
- Les contrôles qualité existants ne sont ni affaiblis ni contournés pour obtenir un résultat vert.

## Cycle de contribution

- Avant de coder, le PBI fixe un outcome unique et les chemins autorisés. La commande
  `python Scripts/quality_gate.py scope --base origin/main --allow <chemin> [...]` compare en une seule
  inspection les changements suivis et non suivis à ce périmètre. Un chemin inattendu bloque le travail ;
  une portée `massive` exige l'acquittement explicite `--allow-massive` avant de poursuivre.
- Pendant le développement, exécuter seulement le test, le lint ou le typecheck directement lié au risque
  que le dernier changement vient d'introduire. Ne pas relancer un contrôle inchangé et ne pas produire de
  couverture, build, rapport ou preuve canonique avant que leur résultat puisse changer une décision.
- `git commit` est un checkpoint local purement technique. Il peut figer un état transitoire, n'implique ni
  validation, ni mise à jour artificielle du README, ni intention de push.
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
