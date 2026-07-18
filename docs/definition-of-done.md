# Definition of Done (DoD)

Une tâche est « Done » uniquement lorsque la validation complète est verte et que tous les critères
ci-dessous sont respectés. Une validation ciblée réussie constitue un retour rapide, pas une preuve de
conformité DoD.

Le standard [`STD-TEST-001`](standards/STD-TEST-001.md) définit la norme de classification, de qualité et
de pilotage des tests. La présente DoD conserve les conditions opérationnelles de validation, de conformité
et de publiabilité du dépôt. En cas d’exigences plus strictes dans la DoD ou les gates existantes, celles-ci
restent applicables.

## 1. Niveaux de validation

- **Validation ciblée** : plan `targeted` ou `impacted` construit à partir des chemins modifiés. Elle couvre
  les contrôles généraux obligatoires, les tests directs et, pour `impacted`, les dépendances proches du
  domaine concerné.
- **Validation massive** : plan complet déclenché par un changement transverse, structurel, central,
  inconnu ou ambigu. Toute résolution incertaine se replie vers `massive`.
- **Validation complète** : task VS Code `Coverage: 8 terminaux`, avec lint, typecheck, couvertures Python
  et frontend, build, E2E, Vitals et convention de nommage.
- **Conformité DoD** : validation complète verte, seuils respectés, documentation normative cohérente,
  sécurité et traçabilité vérifiées.
- **Publiabilité** : conformité DoD, worktree Git valide, branche courante identifiée et remote GitHub
  confirmé. Une validation partielle ne doit jamais être présentée comme publiable.

## 2. Orchestration des gates

- Le pré-commit exécute `python Scripts/quality_gate.py fast`. La liste et le contenu contrôlés proviennent
  de l’index Git ; les modifications non indexées sont ignorées.
- Le pré-push lit les références transmises par Git, calcule les commits introduits et valide chaque SHA
  terminal distinct dans un worktree détaché temporaire. Il n’utilise aucun stash et ignore le workspace
  courant.
- La CI exécute `python Scripts/quality_gate.py ci` sur le checkout GitHub Actions. Elle conserve le plan
  massif et ajoute le smoke test Docker obligatoire.
- Les gates sont fail-fast. Une suppression de référence au pré-push ne déclenche pas de suite.
- Les plans agrégés sont déterministes et sans commande identique répétée. Quand une suite avec couverture
  est requise, la même suite simple n’est pas exécutée auparavant.

## 3. Vérifications obligatoires

- Frontend : `npm --prefix frontend run lint -- --max-warnings 0` passe sans erreur ni avertissement.
- TypeScript : `npm --prefix frontend run typecheck` passe sans erreur.
- Python : la suite Pytest sélectionnée ou complète passe sans erreur pour le backend et l’outillage.
- Frontend unitaire : la suite Vitest sélectionnée ou complète passe sans erreur.
- E2E : `npm --prefix frontend run test:e2e` passe sur les parcours critiques.
- Build : `npm --prefix frontend run build` passe sans erreur.
- Sécurité, secrets, frontière d’identité, README, DoD et convention de nommage restent bloquants lorsqu’ils
  sont applicables.
- Le ratchet de maintenabilité reste bloquant : une dette enregistrée peut rester stable ou diminuer, mais
  une dette nouvelle ou aggravée échoue.

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
- Tout futur enregistrement de classification respecte le catalogue
  [`test-classification.json`](../config/test-classification.json) et son schéma
  [`test-classification.schema.json`](../config/test-classification.schema.json). Le PBI 1.4 définit ce
  contrat sans classifier les tests existants et sans ajouter de contrôle bloquant ; ces étapes restent
  explicitement réservées aux PBI suivants.

Seuls le code trivial et le code purement déclaratif sans logique peuvent rester sans tests.

## 6. Sécurité et qualité du changement

- Aucun secret n’est commité.
- Les variables d’environnement nécessaires sont documentées et alignées avec le code.
- Les garde-fous de sécurité, de couverture, de CI, de hooks et de gates ne sont jamais affaiblis pour
  obtenir un résultat vert.
- Le code est lisible, explicite et maintenable.
- Aucun `TODO` ou `FIXME` critique n’est laissé sans ticket associé.
- Les impacts, risques et commandes de validation sont explicités dans la PR.
- `README.md` et les documents spécialisés sont mis à jour lorsqu’une commande, un seuil, un artefact ou un
  workflow change.

## Checklist DoD

- [ ] Plan adapté au changement exécuté sans repli non traité.
- [ ] Task `Coverage: 8 terminaux` entièrement verte.
- [ ] Lint frontend et backend, typecheck, tests, build et E2E verts.
- [ ] Couvertures Python et frontend >= 80 % ; chaque source Python mesurée est sans ligne rouge.
- [ ] Couvertures E2E `statements`, `branches`, `functions` et `lines` >= 80 %.
- [ ] Integration: couverture globale >= 80%.
- [ ] Points vitaux touchés : couverture ciblée >= 95 % et tests ciblés ajoutés.
- [ ] Artefacts de couverture présents, cohérents, frais et issus de l’exécution attendue.
- [ ] Aucun secret commité et frontière d’identité respectée.
- [ ] Ratchet de maintenabilité vert, sans régénération automatique de la baseline.
- [ ] Documentation normative et README cohérents avec le comportement livré.
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
