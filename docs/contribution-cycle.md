# Cycle de contribution proportionné

Ce document fixe le chemin de contribution local. Il sépare trois intentions qui ne doivent plus être
confondues : contrôler tôt le périmètre, obtenir un retour ciblé pendant le développement, puis prouver la
publiabilité d'un état final.

## Compromis retenu

Le coût de validation nul du checkpoint et le coût élevé de publication sont assumés : un commit enregistre
un état local, tandis qu'un push engage le dépôt partagé. La qualité n'est donc pas répartie uniformément
sur tous les gestes Git ; elle est concentrée sur le seul état qui peut devenir public.

La CI conserve le profil complet après le push. Cette répétition est nécessaire : un hook local peut être
absent ou contourné, alors que GitHub constitue la frontière de confiance qui autorise publication d'image et
déploiement Pages.

## 1. Fixer et contrôler le périmètre

Déclarer les chemins permis au début du PBI, puis lancer le contrôle après la première tranche cohérente :

```powershell
python Scripts/quality_gate.py scope --base origin/main `
  --allow AGENTS.md `
  --allow README.md `
  --allow ".githooks/*" `
  --allow "Scripts/quality_gate*.py" `
  --allow "tests/test_quality_gate.py" `
  --allow "docs/*" `
  --allow-massive
```

La commande effectue trois lectures Git : résolution du merge-base, diff complet du worktree contre cette
base, puis fichiers non suivis non ignorés. Elle ne lance aucun test, ne régénère rien et n'écrit aucun
artefact. Tout chemin hors des motifs déclarés échoue. `--allow-massive` est obligatoire quand un hook, une
gate, une dépendance ou une autre autorité transverse rend la validation finale coûteuse ; cet acquittement
rend le coût visible avant que le PBI ne s'élargisse.

Relancer exactement le même contrôle avant publication. Une différence inattendue conduit à réduire ou à
raffiner le PBI, pas à élargir silencieusement les motifs.

## 2. Développer avec du retour utile

Choisir la commande la plus étroite qui peut invalider l'hypothèse en cours, par exemple :

```powershell
python -m pytest -q tests/test_quality_gate.py
npm --prefix frontend run test:unit -- src/components/Example.test.tsx
npm --prefix frontend run typecheck
```

Un contrôle réussi n'est relancé que si une entrée pertinente a changé. Les couvertures globales, E2E,
builds, rapports et preuves statistiques attendent l'état candidat. Le mode `fast` reste disponible pour un
diagnostic volontaire du snapshot indexé, mais il n'est plus couplé au commit et ne constitue jamais une
preuve de publication.

`git commit` peut être utilisé à tout moment comme checkpoint. Il ne lance aucune validation et n'exige pas
une modification artificielle de `README.md`.

## 3. Publier une seule fois

Avant le push :

1. resynchroniser la branche sur le dernier `origin/main` ;
2. résoudre les conflits et exécuter seulement les tests ciblés rendus utiles par cette résolution ;
3. relancer le contrôle de périmètre avec les mêmes motifs ;
4. commiter l'état final et vérifier la branche ainsi que le remote GitHub ;
5. exécuter `git push` sans lancer préalablement la task canonique identique.

Le pré-push lit les références réellement envoyées. Pour chaque plage introduisant de nouveaux commits,
`README.md` racine doit exister dans l'état final et son blob doit différer de celui de chacune des bases de
la plage. Un README imbriqué, supprimé, modifié uniquement dans le worktree ou revenu à son contenu initial
ne satisfait pas cette règle. Cette vérification précède le DAG coûteux ; la pertinence de la synthèse
livrée reste contrôlée en revue.

Le pré-push scanne tous les commits introduits — un secret ajouté puis retiré reste donc bloquant — et
valide une seule fois chaque SHA terminal distinct dans un worktree détaché. Le contrôle de dépôt vérifie
l'encodage et les accents du README final, la DoD et les secrets de l'arbre final. Tout candidat utilise le
profil `main` complet, quelle que soit sa classification `targeted`, `impacted` ou `massive`. Couvertures,
build, E2E, preuves statistiques, gouvernance, agrégation et smoke Docker sont obligatoires. L'environnement
Docker non secret est matérialisé depuis `.env.example` dans le worktree de validation, puis supprimé.

La sortie normale résume niveau, profil, nombre de commandes et chemins déclencheurs. La liste exhaustive
reste accessible avec `--verbose-plan`; en cas d'échec, la commande fautive et sa correction attendue sont
toujours affichées.

## Autorités statiques et preuves d'exécution

L'inventaire de classification et le plan sont régénérés seulement si leurs sources ont changé.
Les compteurs ne sont plus une entrée préalable à leur propre exécution : l'agrégateur consolide les
résultats natifs du candidat, écrit le rapport puis applique les vérifications d'empreinte et de cohérence
existantes. La CI archive ce rapport avec l'inventaire et le plan du même SHA. Le contrôle direct
`--check` reste disponible après exécution ; le profil de développement `pr` ne prétend pas produire un
compteur global de publication. La [référence initiale](../reports/contribution-cycle-before-counts.json)
reste conservée pour l'audit.

## Mesurer le coût

Comparer le même périmètre et le même environnement :

- nombre de commandes dans `build_execution_plan` ;
- durée murale du hook ou du contrôle de périmètre ;
- nombre de lignes et octets UTF-8 de stdout + stderr ;
- nombre de validations réellement exécutées avant publication ;
- durée et verdict du profil canonique au push.

Mesures de migration acquises sur le même poste Windows :

| Mesure | Avant | Après | Gain récurrent |
| --- | ---: | ---: | ---: |
| Commandes préparées par le commit | 16 | 0 | 100 % |
| Commandes préparées par le push massif | 36 | 37 | scan historique ajouté, plus smoke Docker |
| Un checkpoint suivi d'un push | 52 | 37 | 15 commandes, soit 28,85 % |
| Coût du hook de commit | 92,233 s | médiane 0,069695 s | environ 92,16 s par checkpoint |
| Sortie du hook | 197 lignes / 12 593 octets | 0 / 0 | 100 % |
| Affichage du plan de push | 40 lignes / 12 741 octets | 2 lignes / 260 octets | 95 % des lignes, 97,96 % des octets |
| Scope, sans validation | absent | médiane 0,269485 s ; 3 lectures Git | dérive détectée avant les suites |

Le temps avant est un échantillon réussi de la gate `fast` massive. Les médianes après proviennent de
11 mesures ; la sortie du plan compact a été relevée à 43 chemins et peut varier avec le périmètre.
Les mesures intermédiaires conservées étaient : hook 0,070232 s, scope 0,252394 s et plan compact
282 octets à 19 fichiers. Le premier relevé de scope avait pris 0,297 s pour 4 lignes et 526 octets.
Ces nombres ne prédisent pas la durée du profil complet. L'audit, les tests de migration et les
régénérations statiques nécessaires sont un coût ponctuel, distinct du coût de chaque contribution.
Aucune exécution complète n'est nécessaire pour régénérer les compteurs avant la validation canonique.
