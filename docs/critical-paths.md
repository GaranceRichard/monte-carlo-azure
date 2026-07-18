# Chemins critiques

Ce document référence les points vitaux du produit qui exigent une couverture de tests ciblée d’au moins
95 %. Les preuves détaillées et les artefacts associés sont décrits dans
[`vitals-traceability.md`](vitals-traceability.md).

## Règles

- Toute modification d’un point vital doit inclure des tests ciblés.
- Les tests couvrent les cas nominaux et les cas d’erreur critiques.
- La couverture est mesurée à partir de l’artefact Python complet — dont la portion backend — et des
  artefacts frontend unitaire et E2E de l’exécution complète.
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

## Description détaillée des parcours officiels

### CP-001 — SLA Identité

- **Objectif** : calculer une prévision sans transmettre au backend le PAT ni le contexte d'identification
  Azure DevOps.
- **Acteurs ou composants** : utilisateur, navigateur, client Azure DevOps, service de prévision frontend,
  `POST /simulate`, persistance MongoDB.
- **Préconditions** : un PAT et un contexte organisation/projet/équipe sont présents dans le navigateur.
- **Étapes principales** : le navigateur collecte le throughput directement auprès d'Azure DevOps; le service
  construit un payload statistique; le backend valide, calcule et persiste uniquement les données anonymes.
- **Résultat attendu** : aucun PAT, URL serveur ou contexte Azure DevOps ne franchit la frontière backend.
- **Risques associés** : `RISK-001`.
- **Niveaux actuellement mobilisés** : contrôles statiques de dépôt, tests unitaires des constructeurs de
  payload, tests de composant du service et E2E avec trafic simulé.
- **Contrôles non fonctionnels** : sécurité, confidentialité, conformité de la frontière d'identité.
- **Preuves existantes** : `Scripts/check_identity_boundary.py`, `tests/test_identity_boundary.py`,
  `frontend/src/hooks/Simulationforecastservice.test.tsx`, `frontend/tests/e2e/onboarding.spec.js`.
- **État** : couvert dans le périmètre inspecté.
- **Lacunes connues** : aucune preuve dynamique sur un vrai tenant ni sur une future chaîne externe de logs
  ou télémétrie; le contrôle doit rester bloquant.

### CP-002 — Cookie `IDMontecarlo`

- **Objectif** : conserver un identifiant anonyme pour l'historique backend sans l'envoyer à Azure DevOps.
- **Acteurs ou composants** : navigateur, gestion du cookie, client Azure DevOps, backend.
- **Préconditions** : le navigateur ouvre l'application et peut contacter le backend et Azure DevOps.
- **Étapes principales** : création/lecture du cookie; appel backend avec credentials same-origin; appels ADO
  directs sans credentials navigateur.
- **Résultat attendu** : le cookie atteint seulement le backend Monte Carlo, jamais les domaines ADO.
- **Risques associés** : `RISK-002`.
- **Niveaux actuellement mobilisés** : unitaire et E2E avec interception réseau.
- **Contrôles non fonctionnels** : sécurité et confidentialité.
- **Preuves existantes** : `frontend/src/clientId.ts`, `frontend/src/clientId.test.ts`,
  `frontend/src/adoClient.ts`, `frontend/tests/e2e/coverage.spec.js`.
- **État** : couvert dans le périmètre inspecté.
- **Lacunes connues** : les destinations E2E sont simulées; aucun test n'observe un échange réel avec ADO.

### CP-003 — Endpoint backend `POST /simulate`

- **Objectif** : accepter un contrat borné, produire une simulation déterministe avec seed et répondre de
  façon contrôlée aux entrées invalides, limites et dépendances indisponibles.
- **Acteurs ou composants** : client frontend, FastAPI/Pydantic, rate limiter, moteur Python, MongoDB et Redis.
- **Préconditions** : un historique de throughput et les paramètres du mode sont disponibles.
- **Étapes principales** : validation du payload; filtrage des échantillons; calcul par lots; calcul des
  percentiles, censures, histogramme et score; réponse; persistance asynchrone éventuelle.
- **Résultat attendu** : réponse conforme et reproductible avec seed, ou erreur HTTP explicite sans calcul
  hors bornes.
- **Risques associés** : `RISK-003`, `RISK-004`, `RISK-005`, `RISK-011`, `RISK-013`, `RISK-016`, `RISK-017`.
- **Niveaux actuellement mobilisés** : unitaire du moteur, composant/API, intégration Mongo conditionnelle et
  contrôle de contrat par modèles Pydantic.
- **Contrôles non fonctionnels** : sécurité, performance bornée, timeout, limitation de débit, résilience
  partielle et observabilité par logs.
- **Preuves existantes** : `backend/api_models.py`, `backend/api_routes_simulate.py`, `backend/mc_core.py`,
  `tests/test_api_simulate.py`, `tests/test_mc_core.py`, `tests/test_api_history.py`,
  `tests/test_simulation_store.py`.
- **État** : partiellement couvert.
- **Lacunes connues** : absence de contrat partagé Python/TypeScript, de test de charge, de preuve
  d'annulation du thread après timeout et de politique de proxy de confiance.

### CP-004 — Flux onboarding critique

- **Objectif** : permettre le passage `PAT` → organisation → projet → équipe sur Cloud et Server/TFS sans
  exposer le secret au backend.
- **Acteurs ou composants** : utilisateur, composants d'onboarding, hook d'orchestration, client ADO.
- **Préconditions** : navigateur compatible, réseau ADO accessible et PAT valide.
- **Étapes principales** : validation du PAT; découverte ou saisie du scope; chargement des projets; chargement
  des équipes; sélection finale.
- **Résultat attendu** : équipe sélectionnée ou erreur explicite, sans relais backend du PAT.
- **Risques associés** : `RISK-001`, `RISK-002`, `RISK-006`, `RISK-007`, `RISK-018`, `RISK-019`.
- **Niveaux actuellement mobilisés** : unitaires des URL et erreurs, composants/hooks, E2E sur Chromium avec
  réponses ADO simulées.
- **Contrôles non fonctionnels** : sécurité, gestion d'erreur, accessibilité ponctuelle au clavier et
  compatibilité Cloud/on-premise logique.
- **Preuves existantes** : `frontend/src/adoPlatform.test.ts`, `frontend/src/adoClient.test.ts`,
  `frontend/src/hooks/useOnboarding.test.tsx`, `frontend/src/App.test.tsx`,
  `frontend/tests/e2e/onboarding.spec.js`, `frontend/tests/e2e/selection.spec.js`.
- **État** : partiellement couvert.
- **Lacunes connues** : aucune instance ADO réelle dans la suite, aucune matrice Server/TFS ou navigateurs,
  aucun audit WCAG automatisé.

### CP-005 — Export de rapport simulation ou portefeuille (`SVG`/`PDF`)

- **Objectif** : restituer et télécharger un rapport cohérent avec les résultats de l'interface.
- **Acteurs ou composants** : utilisateur, état de simulation/portefeuille, générateurs HTML/SVG, `jsPDF`,
  API de sauvegarde navigateur.
- **Préconditions** : une simulation valide et ses données de présentation sont disponibles.
- **Étapes principales** : construction du rapport; rendu des diagnostics, tableaux et graphiques; pagination;
  création puis sauvegarde du PDF avec repli.
- **Résultat attendu** : téléchargement stable d'un document complet, sans résultat périmé ni divergence
  matérielle avec l'interface.
- **Risques associés** : `RISK-004`, `RISK-008`, `RISK-009`, `RISK-010`, `RISK-018`, `RISK-019`.
- **Niveaux actuellement mobilisés** : unitaires des transformations, composants de rapport et E2E du
  déclenchement d'export.
- **Contrôles non fonctionnels** : robustesse, accessibilité sémantique partielle, compatibilité de sauvegarde
  et stabilité de mise en page.
- **Preuves existantes** : `frontend/src/components/steps/simulationPrintReport.test.ts`,
  `frontend/src/components/steps/simulationExportModules.test.ts`,
  `frontend/src/components/steps/simulationPdfDownload.fallback.test.ts`,
  `frontend/src/components/steps/portfolioPrintReport.test.ts`, `frontend/tests/e2e/coverage.spec.js`.
- **État** : partiellement couvert.
- **Lacunes connues** : pas de validation structurelle d'un PDF réel, de comparaison automatique UI/PDF,
  d'audit WCAG complet ni de matrice multi-navigateurs.

## Parcours candidats à une promotion comme point vital

Ces candidats ne font pas partie de la liste officielle et ne sont pas présentés comme couverts.

### CP-006 — Restaurer ou rejouer une simulation

Important pour éviter `RISK-008`, ce parcours invalide les résultats lorsque les paramètres significatifs
changent et réutilise une seed connue. Il reste partiellement couvert faute d'E2E complet et de migrations de
cache démontrées; les PBI 10.3 et 10.4 doivent traiter ces limites avant toute promotion.

### CP-007 — Persister et reprendre l'historique MongoDB

Important pour `RISK-011`, `RISK-012` et `RISK-017`, ce parcours possède des tests de reconnexion, de health et
un test d'intégration conditionnel. Il reste partiellement couvert : la rétention des clients actifs, la reprise
réelle et le multi-worker ne sont pas maîtrisés. Traitement prévu par les PBI 4.1, 4.2, 6.5 et 11.4.

### CP-008 — Produire une preuve qualité fiable

Important pour `RISK-020`, ce parcours orchestre couvertures, fraîcheur des artefacts, Vitals et ratchet. Il
reste partiellement couvert tant que classification, dénombrement, mutation testing et reporting consolidé ne
sont pas en place. Traitement prévu par les PBI 1.4 à 1.10 et 6.3.

### CP-009 — Construire un historique ADO temporellement cohérent

Important pour `RISK-006` et `RISK-007`, ce parcours filtre les semaines partielles et rend certains échecs de
collecte visibles. Il reste partiellement couvert faute de qualification globale de la complétude et de tests
sur plateformes réelles. Traitement prévu par les PBI 8.6 à 8.12.
