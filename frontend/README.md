# Frontend Monte Carlo Azure

Frontend React + Vite de Monte Carlo Azure.
Cette application appelle Azure DevOps directement depuis le navigateur, puis envoie uniquement des donnees anonymisees de throughput au backend FastAPI pour la simulation.

## Scripts utiles

Depuis `frontend/` :

```bash
npm install
npm run dev
```

Scripts disponibles :

- `npm run dev` : demarrage Vite en local
- `npm run build` : build production
- `npm run typecheck` : verification TypeScript
- `npm run lint -- --max-warnings 0` : lint strict ESLint
- `npm run test:unit` : tests unitaires Vitest
- `npm run test:unit:coverage` : tests unitaires avec coverage
- `npm run test:e2e` : tests Playwright
- `npm run test:e2e:coverage:console` : execution e2e avec reporting console

## Capacites frontend

Le frontend couvre notamment :

- onboarding Azure DevOps (`PAT` -> organisation -> projet -> equipe)
- ecran de simulation avec percentiles, distributions et `Risk Score`
- historique local des simulations
- mode portefeuille multi-equipes
- export PDF des restitutions simulation et portefeuille
- persistance locale de certaines preferences et quick filters

## Contraintes d'architecture

- le `PAT` Azure DevOps reste cote navigateur
- aucun appel frontend ne doit envoyer de secret Azure DevOps au backend
- les appels backend concernent uniquement la simulation et l'historique client

## Qualite

La CI frontend execute :

- `npm ci`
- `npm run lint -- --max-warnings 0`
- `npm run test:unit:coverage`
- `npm run test:e2e`
- `npm run build`

## Liens utiles

- vue produit : [`../PRODUCT.md`](../PRODUCT.md)
- architecture : [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
- guide principal : [`../README.md`](../README.md)
