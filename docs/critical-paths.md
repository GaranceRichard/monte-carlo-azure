# Critical Paths

Ce document reference les points vitaux du produit qui exigent une couverture de tests cible >= 95%.

## Regles

- Toute modification d'un point vital doit inclure des tests cibles.
- Les tests doivent couvrir les cas nominaux et les cas d'erreur critiques.
- La couverture est suivie en continu dans la CI.

## Liste officielle des points vitaux

- SLA Identite: aucune donnee d'identification Azure DevOps (PAT, UUID, ORG, Team) ne transite par un serveur applicatif.
- Endpoint backend `POST /simulate`: validation, robustesse, et comportement deterministe sur erreurs.
- Flux onboarding critique: PAT -> organisation -> projet -> equipe.
- Export rapport simulation (SVG/PDF): generation stable et non regressif.

