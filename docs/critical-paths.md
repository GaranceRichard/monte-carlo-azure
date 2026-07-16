# Chemins critiques

Ce document référence les points vitaux du produit qui exigent une couverture de tests ciblée d’au moins
95 %. Les preuves détaillées et les artefacts associés sont décrits dans
[`vitals-traceability.md`](vitals-traceability.md).

## Règles

- Toute modification d’un point vital doit inclure des tests ciblés.
- Les tests couvrent les cas nominaux et les cas d’erreur critiques.
- La couverture est mesurée à partir des artefacts backend, frontend unitaire et E2E de l’exécution
  complète.
- Une source vitale absente du rapport ou une métrique réellement mesurable sous 95 % bloque la conformité
  Vitals.

## Liste officielle des points vitaux

- SLA Identité : aucune donnée d’identification Azure DevOps (`PAT`, `UUID`, `ORG`, `Team`) ne transite par
  un serveur applicatif.
- Cookie `IDMontecarlo` : il ne doit jamais transiter vers `dev.azure.com` ou
  `app.vssps.visualstudio.com`.
- Endpoint backend `POST /simulate` : validation, robustesse et comportement déterministe sur les erreurs.
- Flux onboarding critique : `PAT` → organisation → projet → équipe.
- Export de rapport simulation ou portefeuille (`SVG`/`PDF`) : génération stable et non régressive.
