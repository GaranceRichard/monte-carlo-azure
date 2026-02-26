# Definition of Done (DoD)

Une tache est "Done" uniquement si tous les criteres ci-dessous sont valides. Cette DoD vise explicitement l'excellence d'ingenierie.

## 1. Verifications obligatoires (zero tolerance)

- Frontend: `npm run lint` passe sans erreur.
- Backend: `python manage.py test` passe sans erreur.
- E2E: `npm run test:e2e` passe sur les parcours critiques.
- Build: `npm run build` passe sans erreur.

Aucune fusion n'est autorisee si un seul de ces checks echoue.

## 2. Couverture de code (seuils stricts)

Seuils minimaux par couche:
- Backend: couverture globale >= 80%.
- Frontend: couverture globale >= 80%.
- E2E: couverture globale >= 80%.
- Integration: couverture globale >= 80%.

Seuils sur les points vitaux:
- Les points vitaux doivent viser >= 95% de couverture.
- La liste officielle des points vitaux est maintenue dans `docs/critical-paths.md`.
- Tout changement touchant un point vital doit inclure des tests cibles sur ce point vital.

## 3. Exigences minimales par feature

Chaque feature doit contenir au minimum:
- 2 tests passants (cas nominal + variation pertinente).
- 1 test non passant (cas d'erreur / test negatif / garde-fou).

Une feature sans ce triplet minimal n'est pas consideree comme "Done".

## 4. Pyramide de tests et absence de zones grises

- Les controles de conformite DoD (gouvernance repo) sont distincts des tests d'integration applicatifs.
- La pyramide de tests doit rester coherente (majorite de tests unitaires).
- Les tests d'integration couvrent les frontieres reelles (API, DB, cache, auth).
- Les E2E couvrent uniquement les parcours critiques, mais ils existent reellement.
- Aucune partie significative du code n'est laissee sans tests.

Sont toleres sans tests uniquement:
- le code trivial;
- le code purement declaratif sans logique.

## 5. Securite, configuration et robustesse

- Aucun secret n'est commite.
- Les variables d'environnement necessaires sont documentees et alignees avec le code.
- Les garde-fous de securite ne sont pas affaiblis par defaut.
- Tout endpoint public ou sensible a un niveau de protection explicite (validation, permissions, throttling si pertinent).

## 6. Qualite de changement (review-ready)

- Le code est lisible, explicite, et maintenable.
- Aucun `TODO` / `FIXME` critique n'est laisse sans ticket associe.
- Les impacts et risques sont identifies dans la PR.
- La PR explique clairement: quoi, pourquoi, comment tester.
- Le `README.md` est mis a jour si une commande, une variable d'environnement ou un flux change.

## Checklist DoD

- [ ] Frontend: `npm run lint` passe sans erreur.
- [ ] Backend: `python manage.py test` (ou equivalent projet) passe sans erreur.
- [ ] E2E: `npm run test:e2e` passe sur les parcours critiques.
- [ ] Build: `npm run build` passe sans erreur.
- [ ] Couverture backend >= 80%.
- [ ] Couverture frontend >= 80%.
- [ ] Couverture e2e >= 80%.
- [ ] Couverture integration >= 80%.
- [ ] Si point vital touche: couverture cible >= 95% + tests cibles ajoutes.
- [ ] Feature couverte par au minimum 2 tests passants + 1 test negatif.
- [ ] Aucun secret commite.
- [ ] Variables d'environnement documentees et coherentes.
- [ ] Impacts/risques explicites dans la PR.
- [ ] PR documente: quoi, pourquoi, comment tester.
- [ ] `README.md` mis a jour si necessaire.
