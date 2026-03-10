# Frontend Monte Carlo Azure

Frontend React + Vite de Monte Carlo Azure.
Cette application appelle Azure DevOps directement depuis le navigateur, puis envoie uniquement des donnees anonymisees de throughput au backend FastAPI pour la simulation.

## Azure DevOps Cloud et on-prem

Le frontend supporte maintenant deux modes d'acces Azure DevOps :

- Azure DevOps Cloud
- Azure DevOps Server / TFS on-premise

Regle de detection :

- URL Azure vide => mode Cloud
- hote `dev.azure.com` ou `*.visualstudio.com` => mode Cloud
- tout autre hote => mode on-prem

Comportement d'onboarding :

- Cloud : renseigner uniquement le `PAT`
- On-prem : renseigner le `PAT` et l'`URL Azure`
- l'URL on-prem attendue est l'URL serveur + collection
  - exemple : `https://ado.monentreprise.local/tfs/DefaultCollection`
  - exemple : `https://devops700.itp.extra/700`

Si une URL on-prem plus profonde est saisie, le frontend tente de retrouver la premiere collection valide de gauche a droite, puis normalise l'URL retenue pour la suite du flux.

Important :

- le `PAT` reste cote navigateur
- aucun secret Azure DevOps n'est envoye au backend
- les appels on-prem utilisent une `api-version` compatible serveur (`6.0`)
- les appels Cloud utilisent l'`api-version` Azure DevOps Services (`7.1`)

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

Couverture critique frontend :

```powershell
$env:VITALS_FRONTEND_COVERAGE="1"
npm run test:unit:coverage
```

## Capacites frontend

Le frontend couvre notamment :

- onboarding Azure DevOps (`PAT` -> organisation -> projet -> equipe)
- support Cloud et Azure DevOps Server / TFS on-premise
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
