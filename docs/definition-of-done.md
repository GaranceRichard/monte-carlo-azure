# Definition of Done (DoD)

Une tâche est « Done » uniquement lorsque la validation complète est verte et que tous les critères
ci-dessous sont respectés. Une validation ciblée réussie constitue un retour rapide, pas une preuve de
conformité DoD.

Le standard [`STD-TEST-001`](standards/STD-TEST-001.md) définit la norme de classification, de qualité et
de pilotage des tests. La présente DoD conserve les conditions opérationnelles de validation, de conformité
et de publiabilité du dépôt. En cas d’exigences plus strictes dans la DoD ou les gates existantes, celles-ci
restent applicables.

## 1. Niveaux de validation

- **Retour ciblé de développement** : test, lint ou typecheck choisi à partir du risque modifié. Il est lancé
  explicitement lorsqu'il peut invalider une hypothèse, sans couverture, génération ou preuve globale.
- **Validation massive** : plan complet déclenché par un changement transverse, structurel, central,
  inconnu ou ambigu. Le contrôle de périmètre exige son acquittement explicite avant développement ; ce
  classement ne déclenche pas à lui seul une gate coûteuse.
- **Validation complète** : pré-push du candidat, ou task VS Code `Validation : profil main` pour diagnostic,
  avec conformité de classification, lint, typecheck, couvertures Python et frontend, build, E2E, Vitals,
  convention de nommage, smoke Docker et sous-DAG statistique bloquant décrit dans
  [`statistical-main-enforcement.md`](statistical-main-enforcement.md).
- **Conformité DoD** : validation complète verte, seuils respectés, documentation normative cohérente,
  sécurité et traçabilité vérifiées.
- **Publiabilité** : conformité DoD, worktree Git valide, branche courante identifiée et remote GitHub
  confirmé. Une validation partielle ne doit jamais être présentée comme publiable.

## 2. Orchestration des gates

- `git commit` est un checkpoint local sans validation : il peut figer un état transitoire et reste
  indépendant du push. Le hook pré-commit n'exécute aucune gate et aucune modification artificielle du
  README n'est exigée.
- Après la configuration unique des hooks, le `post-checkout` d'un worktree branché crée ou synchronise son
  `.venv` physique depuis `requirements.txt`, refuse liens et junctions, vérifie l'interpréteur et `pip check`,
  puis n'écrit son empreinte qu'après succès. Cette préparation précède le premier scope ou test local.
- `.venv\Scripts\python.exe Scripts/quality_gate.py scope --base <référence> --allow <chemin> [...]` compare le worktree entier
  au merge-base, inclut les fichiers non suivis non ignorés, refuse tout chemin hors périmètre et exige
  `--allow-massive` pour une autorité transverse. Il n'exécute aucun test et ne génère aucun artefact.
- Pendant le développement, les tests sont invoqués directement et au plus près du risque. Le mode `fast`
  reste un diagnostic volontaire de l'index ; son succès n'est ni requis au commit ni réutilisé comme preuve
  de publication.
- Le pré-push lit les références transmises par Git, calcule les commits introduits et valide chaque SHA
  terminal distinct dans un worktree détaché temporaire. Il n’utilise aucun stash et ignore le workspace
  courant. Une entrée totalement vide réussit sans lancer la gate ; toute ligne non vide malformée reste
  bloquante.
- Chaque candidat pré-push exécute le profil `main` complet, même si ses chemins sont `targeted` ou
  `impacted`. Tous les commits introduits sont scannés avant publication ; supprimer d'un commit final un
  secret présent dans un checkpoint antérieur ne suffit pas.
- Avant le DAG coûteux, le pré-push exige, pour chaque plage introduisant de nouveaux commits, un
  `README.md` racine présent dans l'état final et un blob différent de celui de chacune des bases de la
  plage. La pertinence de la synthèse reste contrôlée en revue ; aucun checkpoint isolé n'impose d'édition.
- Le cycle normal n'exécute pas la task canonique avant le push : le hook valide une seule fois chaque SHA
  terminal distinct avant le transfert. Une nouvelle exécution n'est utile qu'après modification du
  candidat ou résolution d'un échec ; la CI distante conserve sa propre frontière de confiance.
- Avant d'appeler `quality_gate.py`, le pré-push réutilise le bootstrap idempotent du worktree. Un échec de
  création, de synchronisation, de sonde ou de `pip check` bloque sans démarrer le plan canonique. Après ce
  prérequis, le hook ne possède aucun fallback vers le Python système et exécute uniquement l'interpréteur
  `.venv` local ; toutes les gates et tous les préflights existants restent inchangés.
- Le snapshot volontaire du mode `fast` matérialise l’index sans `.git`. Les tests qui ne portent pas sur
  Git injectent explicitement cette frontière déjà isolée ; les tests du snapshot Git utilisent exclusivement
  un dépôt et un index temporaires. Le snapshot complet de `main` continue d’exiger un dépôt et un index
  valides.
- Toute validation isolée transmet `MONTECARLO_E2E_PYTHON` avec l’interpréteur du `.venv` validé du worktree
  contributeur à chaque chemin d’exécution : séquence, branches parallèles du DAG et nœud sélectionné. Le
  serveur Playwright du worktree détaché réutilise ainsi explicitement les dépendances Python locales sans
  créer un second environnement éphémère.
- Tout contrôle déclarant une dépendance à l’outillage frontend réutilise une exposition unique et temporaire
  de `frontend/node_modules` depuis l’installation hôte, même si le plan ne contient aucune commande `npm`.
  Le code, les configurations et les tests restent lus dans le snapshot isolé ; seuls les outils immuables
  sont liés. Une dépendance hôte absente est bloquante et le lien est retiré après succès, échec ou
  interruption.
- La CI résout explicitement `pr`, `main`, `nightly` ou `release`, puis exécute
  `python Scripts/quality_gate.py ci --profile <profil> --node <nœud>` dans plusieurs jobs. `preflight`
  précède les branches indépendantes et `aggregate` dépend de toutes les branches.
- La validation locale complète de `main`, `nightly` ou `release` s’exécute dans une copie temporaire des
  fichiers suivis et non ignorés. Les sorties ne modifient pas les preuves versionnées du workspace ; le
  snapshot, l’exposition unique de `frontend/node_modules` et les temporaires sont nettoyés après succès,
  échec ou interruption.
- Le préflight de chaque candidat pré-push vérifie la disponibilité du moteur avec
  `docker version --format {{.Server.Version}}` avant de lancer les suites coûteuses. Un moteur
  indisponible bloque la gate à ce stade ; la sonde ne remplace ni ne réduit le smoke Docker complet.
- Le smoke Docker du candidat utilise `.env` lorsqu'il est disponible ; dans un worktree détaché sans secret,
  la même configuration que la CI est copiée depuis `.env.example`, puis supprimée après le contrôle.
- Dans `main`, corpus et sondes, parité déterministe, rejeu exact, indépendance du batching, protocole et
  parité distributionnels, compatibilité, génération et validation du rapport consolidé sont obligatoires.
  Les trois preuves indépendantes précèdent la compatibilité ; le rapport consomme leurs artefacts validés
  du run et `aggregate` refuse tout nœud statistique échoué ou sauté.
- La hiérarchie obligatoire est `pr = pr`, `main = pr + main`,
  `nightly = pr + main + nightly` et `release = pr + main + release`.
- Les niveaux `targeted`, `impacted` et `massive` guident le retour de développement et rendent le coût
  visible, mais ne réduisent jamais le profil `main` d'un candidat à publication.
- Les gates sont fail-fast. Une suppression de référence au pré-push ne déclenche pas de suite.
- Les plans agrégés sont déterministes et sans commande identique répétée. Quand une suite avec couverture
  est requise, la même suite simple n’est pas exécutée auparavant.
- Deux branches parallèles ne partagent ni artefact écrit ni ressource exclusive. Leurs artefacts sont
  isolés sous `reports/test-execution-artifacts/<profil>/<nœud>/` avant consolidation.
- Tous les jobs producteurs uploadent `reports/test-execution-artifacts`. `aggregate` télécharge et fusionne
  les preuves dans ce même répertoire, puis le promoteur retrouve les artefacts backend, Vitest et E2E sous
  leur arborescence versionnée par profil et nœud.
- `aggregate` produit `reports/test-execution-counts.json` depuis les artefacts natifs du run canonique avec
  `python Scripts/report_test_execution_counts.py --refresh-and-check`, puis applique les contrôles stricts
  de complétude, d'unicité, d'invariants et d'empreinte. Ce rapport courant est ignoré par Git ; la CI
  l'archive avec l'inventaire et le plan du même SHA. L'agrégateur produit ensuite les preuves Vitals et de
  gouvernance dans l'ordre contractuel, puis écrit `reports/test-strategy-report.json` et `.md` depuis un
  modèle unique. Le rapport n'exige pas le résultat final du nœud qui est encore en train de le produire.
- Le job `aggregate` installe Node 22 et les dépendances verrouillées par `frontend/package-lock.json` avant
  son agrégateur final : le contrôle de gouvernance redécouvre les tests Vitest et Playwright avec TypeScript.

## 3. Vérifications obligatoires

- Frontend : `npm --prefix frontend run lint -- --max-warnings 0` passe sans erreur ni avertissement.
- TypeScript : `npm --prefix frontend run typecheck` passe sans erreur.
- Python : la suite Pytest sélectionnée ou complète passe sans erreur pour le backend et l’outillage.
- Statistique : la politique fermée n’accepte que `match`; toute divergence, non-conclusion, source ou
  décision absente, schéma, empreinte ou fraîcheur invalide, ou erreur moteur, protocole ou infrastructure
  bloque la validation complète.
- Frontend unitaire : la suite Vitest sélectionnée ou complète passe sans erreur.
- E2E : `npm --prefix frontend run test:e2e` passe sur les parcours critiques.
- Build : `npm --prefix frontend run build` passe sans erreur.
- Sécurité, secrets, frontière d’identité, README, DoD et convention de nommage restent bloquants lorsqu’ils
  sont applicables.
- Le ratchet de maintenabilité reste bloquant avec 350 lignes non vides et 50 points de complexité par
  fichier, 50 lignes non vides et 15 points de complexité par fonction : une dette enregistrée peut rester
  stable ou diminuer, mais une dette nouvelle ou aggravée échoue.

Aucune fusion n’est autorisée si un contrôle requis échoue.

## 4. Couverture et artefacts

Seuils minimaux par couche :

- Python exécutable versionné : couverture globale >= 80 %, couverture par fichier >= 80 %, couverture
  de branche active et aucune ligne exécutable non couverte. Le périmètre déclaratif unique couvre
  `backend/`, `Scripts/` et `run_app.py` ; `tests/` est exclu car il constitue le code de test. Le contrôle
  de conformité échoue si un fichier Python exécutable versionné est absent de ce périmètre ou du rapport.
- Frontend : couverture globale >= 80%.
- E2E : `statements`, `branches`, `functions` et `lines` >= 80 %.
- Integration: couverture globale >= 80%.

Les suites avec couverture produisent les artefacts suivants :

- Python : `.coverage` et `.coverage.python.json` ;
- frontend unitaire : `frontend/coverage/coverage-final.json` et
  `frontend/coverage/index.html` ;
- E2E : `frontend/coverage/e2e-coverage-summary.json` ;
- Vitals : `frontend/coverage/vitals-coverage-report.json`.

L’artefact E2E doit être complet, cohérent, frais et rattaché à l’exécution courante par son `runId`, ses
timestamps, son identifiant de périmètre et son fingerprint. Une métrique par fichier sans élément
mesurable est normalisée à `total = covered = skipped = 0` et `pct = 100`; cette règle ne s’applique pas
aux métriques globales, qui restent mesurables et soumises aux seuils.

Le rapport Vitals est construit une seule fois à partir des artefacts existants, puis réutilisé par le
contrôle de conformité. Toute modification d’un artefact source invalide ce rapport.

Sous Windows, la task complète fournit à Pytest un `--basetemp` unique sous `.tmp/pytest`. Seul le
répertoire de l’exécution courante est nettoyé ; le temporaire global de l’utilisateur n’est jamais supprimé.

## 5. Points vitaux et stratégie de tests

- Les risques critiques et leur maîtrise démontrée ou résiduelle sont suivis dans
  [`risk-control-matrix.md`](risk-control-matrix.md).
- Les points vitaux officiellement contrôlés sont définis dans [`critical-paths.md`](critical-paths.md).
- Une couverture critique incomplète reste explicitement visible et ne peut être assimilée à une conformité
  complète à `STD-TEST-001`.
- Les points vitaux doivent viser au moins 95 % de couverture.
- La liste officielle est maintenue dans `docs/critical-paths.md`.
- La correspondance entre points vitaux, tests et artefacts est maintenue dans
  `docs/vitals-traceability.md` et `docs/vitals-coverage-map.json`.
- Tout changement touchant un point vital inclut des tests ciblés nominaux et des cas d’erreur critiques.
- Une fonctionnalité contient au minimum deux tests passants — cas nominal et variation pertinente — et un
  test négatif ou garde-fou.
- Les tests d’intégration couvrent les frontières réelles : API, base de données, cache et authentification
  lorsque ces composants sont concernés.
- Tout enregistrement de classification respecte le catalogue
  [`test-classification.json`](../config/test-classification.json) et son schéma
  [`test-classification.schema.json`](../config/test-classification.schema.json). Le contrôle
  `python Scripts/check_test_classification.py --source-only` doit confirmer l'égalité exacte entre cas
  découverts et inventoriés, `unresolved = 0`, l'absence d'override orphelin et d'exemption expirée. Un
  changement de l'inventaire découvert exige sa régénération statique sur la tranche candidate cohérente.
  Le rapport d'exécution est produit par l'agrégateur à partir du run canonique, puis son empreinte est
  vérifiée contre l'inventaire ; aucune suite complète préalable n'est requise pour préparer ces compteurs.
  Le contrôle direct sans `--source-only` conserve cette vérification et exige le rapport courant.
- Le contrat `config/test-execution-profiles.json` et son schéma sont valides : aucun identifiant dupliqué,
  dépendance absente, cycle, nœud inaccessible, conflit parallèle ou profil sans agrégateur final unique.
- Tout job CI exécutant les tests Pytest qui chargent la classification JavaScript configure Node 22 avec le
  cache npm et exécute `npm --prefix frontend ci` avant la quality gate. L’installation des navigateurs
  Playwright reste limitée au job `e2e`.
- Les actions JavaScript de la CI utilisent leurs versions Node 24 verrouillées : `actions/checkout@v6`,
  `actions/setup-python@v6`, `actions/setup-node@v6`, `actions/upload-artifact@v7`,
  `actions/download-artifact@v8`, `docker/login-action@v4` et `docker/build-push-action@v7`. La variable
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` est absente et sa réintroduction, comme celle d’une ancienne version,
  fait échouer la conformité du dépôt.
- Les déclarations logiques, instances collectées, instances exécutées et tentatives sont des mesures
  distinctes. Un paramètre, un projet ou un retry ne doit jamais gonfler le nombre de cas logiques, et un
  retry ne doit jamais gonfler le nombre d'instances exécutées.
- Tout skip, désactivation, expected failure, mécanisme de quarantaine ou retry détecté dans Pytest, Vitest ou
  Playwright possède une entrée valide dans `config/test-governance.json`. Les entrées orphelines, expirées ou
  incohérentes et les marqueurs inconnus sont interdits.
- Un test critique n'est jamais ignoré. Une quarantaine critique reste exécutée dans son profil et possède une
  mesure compensatoire. Aucun retry global ou automatique aveugle n'est autorisé ; toute tentative conserve
  son résultat initial dans `reports/test-governance-report.json`.
- Le rapport stratégique distingue patrimoine global, exécution profilée et dimensions stratégiques. Son
  `qualityGateStatus` ne masque aucune preuve obligatoire absente, invalide, périmée ou incohérente ; son
  `strategyEvidenceStatus` conserve les capacités futures en `not_measured` sans les transformer en succès.
- Le JSON respecte `config/test-strategy-report.schema.json`, le Markdown provient du même modèle et les deux
  rendus sont déterministes. `evidenceBundleId` identifie seulement le bundle de preuves, pas une exécution
  physique commune. Le snapshot versionné et l'artefact CI conservent des portées distinctes.

Seuls le code trivial et le code purement déclaratif sans logique peuvent rester sans tests.

## 6. Sécurité et qualité du changement

- Aucun secret n’est commité.
- Les variables d’environnement nécessaires sont documentées et alignées avec le code.
- Les garde-fous de sécurité, de couverture, de CI, de hooks et de gates ne sont jamais affaiblis pour
  obtenir un résultat vert.
- Le code est lisible, explicite et maintenable.
- Aucun `TODO` ou `FIXME` critique n’est laissé sans ticket associé.
- Les impacts, risques et commandes de validation sont explicités dans la PR.
- Le README final respecte la règle de publication par plage de nouveaux commits et décrit pertinemment le
  changement livré. La documentation normative évolue lorsque le comportement ou la gouvernance
  correspondante change ; un checkpoint intermédiaire n'impose jamais une édition documentaire artificielle.

## Checklist DoD

- [ ] Périmètre déclaré contrôlé, sans chemin inattendu ni portée massive non acquittée.
- [ ] `.venv` physique exploitable, conforme à l'empreinte de `requirements.txt` et validé par `pip check`
      avant l'entrée dans le plan canonique ; le pré-push utilise exclusivement son Python.
- [ ] Gate pré-push du profil `main` entièrement verte sur le SHA terminal publié.
- [ ] Classification bloquante verte : inventaire exact, déterministe et sans `unresolved` ni exception
      invalide.
- [ ] Gouvernance bloquante verte : aucun mécanisme non gouverné, marqueur inconnu, état critique ignoré,
      quarantaine non compensée, entrée invalide, expirée ou orpheline, ni premier échec masqué.
- [ ] Les quatre plans de profil sont complets, acycliques, déterministes et sans conflit d’artefact.
- [ ] Le reporting stratégique JSON/Markdown du profil est valide, déterministe et produit une seule fois par
      `aggregate`, avec des conclusions et preuves cohérentes.
- [ ] Lint frontend et backend, typecheck, tests, build et E2E verts.
- [ ] Couvertures Python et frontend >= 80 % ; chaque source Python mesurée est sans ligne rouge.
- [ ] Couvertures E2E `statements`, `branches`, `functions` et `lines` >= 80 %.
- [ ] Integration: couverture globale >= 80%.
- [ ] Points vitaux touchés : couverture ciblée >= 95 % et tests ciblés ajoutés.
- [ ] Artefacts de couverture présents, cohérents, frais et issus de l’exécution attendue.
- [ ] Aucun secret commité et frontière d’identité respectée.
- [ ] Ratchet de maintenabilité vert, sans régénération automatique de la baseline.
- [ ] Synthèse du backlog et répartition des reliquats conformes aux tables de PBI, régénérées uniquement
      lorsque leurs autorités sources ont changé, sans divergence.
- [ ] README racine présent et différent des bases de chaque plage de nouveaux commits ; documentation
      normative et synthèse cohérentes avec le comportement livré, sans édition imposée par checkpoint.
- [ ] Worktree et branche vérifiés ; remote GitHub présent avant toute déclaration de publiabilité.

<!--
Libellés historiques stables consommés par les contrôles de conformité documentaire :
1. Verifications obligatoires
2. Couverture de code
3. Exigences minimales par feature
4. Pyramide de tests
5. Securite, configuration et robustesse
6. Qualite de changement
-->
