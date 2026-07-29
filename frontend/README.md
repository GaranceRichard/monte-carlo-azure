# Frontend Monte Carlo Azure

Ce guide couvre le démarrage, la connexion Azure DevOps et les frontières propres au frontend React/Vite.
La présentation des capacités et de la valeur reste dans le [guide principal](../README.md), tandis que
l’[architecture](../ARCHITECTURE.md) fait autorité sur les flux et les contrats.

## Démarrer

Depuis `frontend/` :

```bash
npm install
npm run dev
```

L’interface de développement est disponible par défaut sur `http://localhost:5173`.

Scripts utiles :

- `npm run dev` : serveur Vite local ;
- `npm run build` : build de production ;
- `npm run typecheck` : vérification TypeScript ;
- `npm run lint -- --max-warnings 0` : lint ESLint strict ;
- `npm run test:unit` : tests Vitest ;
- `npm run test:unit:coverage` : tests Vitest avec couverture ;
- `npm run test:e2e` : tests Playwright et validation de l’artefact E2E ;
- `npm run corpus:statistical` : exécution TypeScript du corpus statistique partagé.

La validation complète du dépôt reste la tâche VS Code `Validation : profil main`, exécutée depuis la
racine. Les commandes isolées servent au diagnostic ; elles ne remplacent pas cette gate.

## Se connecter à Azure DevOps

Le frontend supporte :

- Azure DevOps Cloud ;
- Azure DevOps Server/TFS on-premise.

Le mode est déterminé à partir de l’URL saisie :

- URL vide, hôte `dev.azure.com` ou `*.visualstudio.com` : Cloud ;
- tout autre hôte : Server/TFS.

En mode Cloud, le parcours demande le `PAT`. En mode Server/TFS, il demande également l’URL du serveur et
de la collection, par exemple :

- `https://ado.monentreprise.local/tfs/DefaultCollection` ;
- `https://devops700.itp.extra/700`.

Si une URL on-premise plus profonde est fournie, le frontend cherche la première collection valide de
gauche à droite, puis normalise l’URL retenue.

Les appels Cloud utilisent l’`api-version` Azure DevOps Services `7.1`. Les appels Server/TFS utilisent
l’`api-version` compatible serveur `6.0`.

## Frontière d’identité

Le `PAT` et le contexte Azure DevOps restent dans le navigateur. Le frontend appelle Azure DevOps
directement et ne transmet au backend que les données statistiques minimisées nécessaires à la simulation.

`POST /simulate` ne contient jamais :

- `selectedOrg`, `selectedProject` ou `selectedTeam` ;
- `startDate` ou `endDate` ;
- `types` ou `doneStates` ;
- `pat` ou `serverUrl`.

Le cookie `IDMontecarlo` est réservé au backend Monte Carlo et ne doit jamais accompagner un appel vers
Azure DevOps. Les règles complètes et les chemins contrôlés sont définis dans
[`../ARCHITECTURE.md`](../ARCHITECTURE.md#invariants-de-sécurité).

## Données temporelles et historique local

Le throughput utilise uniquement des semaines ISO complètes :

- début aligné sur un lundi ;
- fin alignée sur un dimanche ;
- semaine entièrement incluse dans la période choisie ;
- semaine courante exclue tant qu’elle n’est pas terminée.

Les chaînes `YYYY-MM-DD` sont traitées comme dates locales afin d’éviter un décalage UTC d’un jour.

L’historique détaillé d’une équipe reste dans `localStorage`. Il est contextualisé, versionné et distinct de
l’historique backend statistique minimisé. Les anciennes entrées sans `schemaVersion` sont migrées une seule
fois pour convertir leur ancien `Cycle Time` en semaines vers des jours calendaires, sans modifier le
throughput, `targetWeeks` ni les résultats Monte Carlo.

## Résultats et restitutions

Le frontend consomme le `SimulationResult` métier produit par le chemin HTTP ou le moteur local :

- les percentiles absents restent absents ;
- les censures backlog restent distinctes des durées terminées ;
- le `Risk Score` reçu n’est pas recalculé par la présentation ;
- les diagnostics de qualité des données, d’incertitude et de recommandation restent séparés ;
- toute modification d’un paramètre significatif invalide le résultat affiché ;
- une entrée locale ne peut être réutilisée que si sa signature correspond à la configuration courante.

L’interface et les exports réutilisent les mêmes formulations et la même grammaire visuelle. Les détails
statistiques appartiennent au
[standard normatif](../docs/standards/STD-STAT-001.md) et au
[contrat du corpus](../docs/statistical-reference-corpus.md).

## Structure

- `src/domain/` : modèles et Value Objects métier, sans React, HTTP ni stockage ;
- `src/api/` : DTO HTTP `snake_case` et mappers ;
- `src/storage/` : DTO `localStorage`, mappers et migrations ;
- `src/adapters/` : adaptateurs techniques, dont `mca-prng-v1` ;
- `src/hooks/` : orchestration des parcours et états ;
- `src/components/` : présentation et restitutions ;
- `src/utils/` : calculs et transformations sans état.

Les identifiants de code sont en anglais. Les textes affichés à l’utilisateur restent en français.

## Qualité frontend

Le plan complet :

- exécute le lint et le typecheck ;
- remplace la suite Vitest simple par sa variante avec couverture ;
- applique les seuils de couverture frontend et E2E ;
- vérifie les points Vitals et la gouvernance des skips, quarantaines et retries ;
- construit le frontend de production.

La définition normative des seuils, artefacts et conditions de publiabilité se trouve dans
[`../docs/definition-of-done.md`](../docs/definition-of-done.md). La classification des tests est décrite
dans [`../docs/test-classification.md`](../docs/test-classification.md).

## Liens

- [Porte d’entrée produit](../README.md)
- [Vision produit](../PRODUCT.md)
- [Architecture](../ARCHITECTURE.md)
- [Carte de la documentation](../docs/README.md)
