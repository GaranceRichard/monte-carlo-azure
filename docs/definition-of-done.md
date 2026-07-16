# Definition of Done (DoD)

Une tâche est « Done » uniquement lorsque la validation complète est verte et que tous les critères
ci-dessous sont respectés. Une validation ciblée réussie constitue un retour rapide, pas une preuve de
conformité DoD.

## 1. Niveaux de validation

- **Validation ciblée** : plan `targeted` ou `impacted` construit à partir des chemins modifiés. Elle couvre
  les contrôles généraux obligatoires, les tests directs et, pour `impacted`, les dépendances proches du
  domaine concerné.
- **Validation massive** : plan complet déclenché par un changement transverse, structurel, central,
  inconnu ou ambigu. Toute résolution incertaine se replie vers `massive`.
- **Validation complète** : task VS Code `Coverage: 8 terminaux`, avec lint, typecheck, couvertures backend
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
- Backend : la suite Pytest sélectionnée ou complète passe sans erreur.
- Frontend unitaire : la suite Vitest sélectionnée ou complète passe sans erreur.
- E2E : `npm --prefix frontend run test:e2e` passe sur les parcours critiques.
- Build : `npm --prefix frontend run build` passe sans erreur.
- Sécurité, secrets, frontière d’identité, README, DoD et convention de nommage restent bloquants lorsqu’ils
  sont applicables.

Aucune fusion n’est autorisée si un contrôle requis échoue.

## 4. Couverture et artefacts

Seuils minimaux par couche :

- Backend : couverture globale >= 80%.
- Frontend : couverture globale >= 80%.
- E2E : `statements`, `branches`, `functions` et `lines` >= 80 %.
- Integration: couverture globale >= 80%.

Les suites avec couverture produisent les artefacts suivants :

- backend : `.coverage` et `.coverage.backend.json` ;
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

- Les points vitaux doivent viser au moins 95 % de couverture.
- La liste officielle est maintenue dans `docs/critical-paths.md`.
- La correspondance entre points vitaux, tests et artefacts est maintenue dans
  `docs/vitals-traceability.md` et `docs/vitals-coverage-map.json`.
- Tout changement touchant un point vital inclut des tests ciblés nominaux et des cas d’erreur critiques.
- Une fonctionnalité contient au minimum deux tests passants — cas nominal et variation pertinente — et un
  test négatif ou garde-fou.
- Les tests d’intégration couvrent les frontières réelles : API, base de données, cache et authentification
  lorsque ces composants sont concernés.

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
- [ ] Couvertures backend et frontend >= 80 %.
- [ ] Couvertures E2E `statements`, `branches`, `functions` et `lines` >= 80 %.
- [ ] Integration: couverture globale >= 80%.
- [ ] Points vitaux touchés : couverture ciblée >= 95 % et tests ciblés ajoutés.
- [ ] Artefacts de couverture présents, cohérents, frais et issus de l’exécution attendue.
- [ ] Aucun secret commité et frontière d’identité respectée.
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
