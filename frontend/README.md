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

Le domaine delivery classe chaque tranche avec un statut fermé : `partial_initial`, `complete`,
`partial_final`, ou `partial_initial_and_final` lorsque la même tranche touche les deux bords. Les deux
diagnostics de bord sont conservés séparément dans ce dernier cas. Le client Azure DevOps construit sa
requête uniquement depuis la période `complete` retournée par cette autorité.

Le même domaine définit le throughput comme le nombre de faits `item_delivered` par semaine ISO complète,
dans l’unité `delivered_items_per_complete_iso_week`. Sa transformation applique seule les bornes de la
période, le regroupement UTC et les semaines à zéro ; le client Azure DevOps lui délègue les événements
normalisés. Cette définition ne constitue pas une analyse de stabilité du flux.

`createDeliveryHistory` compare la séquence ordonnée des livraisons attendues aux faits normalisés. Le
résultat immuable conserve le statut `continuous`, `discontinuous` ou `ambiguous`, ses compteurs et ses
diagnostics : chaque plage contiguë d’événements attendus absents est positionnée, tandis qu’une lecture de
révisions indisponible ou une séquence dupliquée/inattendue reste ambiguë. Une collecte réussie sans item est
donc continue et représente une absence réelle d’activité. `adoClient` conserve directement les diagnostics
dans le résultat applicatif ; il ne recalcule pas la continuité et ne relance aucun lot manquant.

Avant throughput et Cycle Time, `qualifyDeliveryChronology` compare les premiers faits de chaque item selon
l’ordre `work_started`, `work_completed`, puis `item_delivered`. Les égalités d’instant sont valides. Une
inversion rejette tous les événements de l’item et produit, pour chaque relation impossible, le code stable
`inverted_delivery_event_order` avec l’identité, les faits et leurs instants. Le résultat immuable conserve
séparément événements cohérents, événements rejetés et diagnostics ; le client Azure DevOps le construit une
fois sans tenter de corriger ses DTO à la source.

Le même domaine définit le Cycle Time comme la durée écoulée entre les premiers événements `work_started` et
`work_completed` d’un item. `calculateCycleTime` l’exprime en jours calendaires de 24 heures, l’arrondit à
deux décimales et le rattache à la semaine ISO UTC de complétion. Un cycle incomplet n’est pas une observation ;
les inversions ont déjà été rejetées par l’autorité chronologique. Les tendances, résumés et restitutions
consomment ces valeurs sans en redéfinir la durée.

`DeliveryHistoryResult` conserve aussi l’unique diagnostic de complétude. L’état est `absent` lorsqu’aucune
période ISO complète n’est disponible, `incomplete` lorsqu’un item requis ne produit pas son fait
`item_delivered`, et `complete` lorsque tous les faits requis sont présents. Une période disponible sans
livraison est donc `complete` et alimente des semaines à throughput nul. La prévision connectée consomme ce
statut et n’appelle pas le moteur pour les états non complets ; aucun affichage de qualité n’est ajouté ici.

`application/team-history` expose le résultat unique `TeamHistoryResult`. Son champ `diagnostics` garde quatre
familles distinctes — `periods`, `completeness`, `continuity` et `chronology` — en réutilisant exactement les
objets immuables produits par le domaine. Le client Azure DevOps retourne ce contrat et la prévision connectée
y lit la complétude ; les avertissements restants décrivent seulement des échecs techniques de collecte. La
formulation et l’affichage fonctionnels de ces diagnostics restent hors de cette frontière.

Les chaînes `YYYY-MM-DD` sont interprétées comme dates calendaires UTC avant ce classement afin d’éviter un
décalage d’un jour.

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
- `src/application/team-history/` : contrat et assemblage sans perte des résultats delivery diagnostiqués ;
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
