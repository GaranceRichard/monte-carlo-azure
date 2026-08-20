# AGENTS.md

## Principes

- Chaque PBI parallèle utilise une branche et un worktree dédiés.
- Le worktree d'un PBI est créé hors du dépôt principal.
- Un PBI ne crée aucun junction, lien symbolique, mount point ou autre reparse point dans son worktree.
- Les contrôles qualité existants ne sont ni affaiblis ni contournés pour obtenir un résultat vert.

## Intégration asynchrone

- Le premier PBI prêt s'intègre et se pousse immédiatement sur `main`, sans attendre les autres PBI.
- Avant de publier, un PBI retardataire se resynchronise sur le dernier `origin/main`, résout ses éventuels conflits et valide l'état final réellement destiné à `main`.
- La validation canonique porte sur cet état final. Les vérifications partielles ne remplacent pas son verdict lorsqu'elle est requise.
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
- la validation canonique requise pour l'état destiné à `main` est verte.

Publier dès que ces conditions sont remplies, sans dépendre de l'avancement ou de l'hygiène locale des autres PBI.
