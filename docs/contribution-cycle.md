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

## 0. Préparer le runtime du worktree

L'initialisation unique `python Scripts/setup_git_hooks.py` configure `core.hooksPath=.githooks` et prépare
le checkout courant. Cette configuration Git commune est héritée par les worktrees liés. Dès lors,
`git worktree add` déclenche le `post-checkout` versionné : avant de rendre la main sur une branche, il crée
le `.venv` local avec `venv --copies`, installe `requirements.txt`, exécute `pip check`, puis écrit
atomiquement une empreinte associant schéma de bootstrap, SHA-256 exact de `requirements.txt`, version du
runtime et inventaire installé. Aucun lien, junction ou environnement partagé n'est créé.

Si l'interpréteur, l'empreinte ou l'inventaire manque ou diverge, le même mécanisme répare ou resynchronise
l'environnement. Si tout concorde, une sonde de l'interpréteur et `pip check` suffisent : aucune installation
n'est rejouée. Le Python système peut seulement amorcer un `.venv` absent ou inexploitable ; il n'exécute
aucune gate. Les plages déclarées dans `requirements.txt` restent l'autorité des versions acceptables ;
l'empreinte rend la décision de synchronisation déterministe sans inventer un verrouillage absent du dépôt.

Le pré-push appelle ce bootstrap avant `quality_gate.py` et bloque immédiatement s'il échoue. Il invoque
ensuite exclusivement `.venv/Scripts/python.exe` sous Windows ou `.venv/bin/python` ailleurs. Le worktree
détaché temporaire créé par la validation canonique ne relance pas l'installation : son HEAD détaché est
reconnu par `post-checkout` et le DAG reçoit explicitement l'interpréteur déjà validé du worktree contributeur.

## 1. Fixer et contrôler le périmètre

Déclarer les chemins permis au début du PBI, puis lancer le contrôle après la première tranche cohérente :

```powershell
.\.venv\Scripts\python.exe Scripts/quality_gate.py scope --base origin/main `
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

Avant même d'interpréter le plan, le hook synchronise et sonde le `.venv` local. Un échec de création,
d'installation, d'empreinte, d'interpréteur ou de `pip check` arrête le push sans créer le worktree détaché
du candidat et sans exécuter une commande canonique. Cette barrière complète les préflights frontend et
Docker existants ; elle ne retire, ne décale après une suite coûteuse ni ne réduit aucun de leurs contrôles.

Le pré-push lit les références réellement envoyées. Pour chaque plage introduisant de nouveaux commits,
`README.md` racine doit exister dans l'état final et son blob doit différer de celui de chacune des bases de
la plage. Un README imbriqué, supprimé, modifié uniquement dans le worktree ou revenu à son contenu initial
ne satisfait pas cette règle. Cette vérification précède le DAG coûteux ; la pertinence de la synthèse
livrée reste contrôlée en revue.

Le pré-push scanne tous les commits introduits — un secret ajouté puis retiré reste donc bloquant — et
valide une seule fois chaque SHA terminal distinct dans un worktree détaché. Le contrôle de dépôt vérifie
l'encodage et les accents du README final, la DoD et les secrets de l'arbre final. Tout candidat utilise le
profil `main` complet, quelle que soit sa classification `targeted`, `impacted` ou `massive`. Couvertures,
build, E2E, preuves statistiques, gouvernance, agrégation et smoke Docker sont obligatoires. Le préflight
du candidat sonde d'abord le moteur avec `docker version --format {{.Server.Version}}` ; une indisponibilité
bloque la gate avant les suites coûteuses. Cette sonde ne remplace pas le smoke complet. L'environnement
Docker non secret est matérialisé depuis `.env.example` dans le worktree de validation, puis supprimé.

La sortie normale résume niveau, profil, nombre de commandes et chemins déclencheurs. La liste exhaustive
reste accessible avec `--verbose-plan`; en cas d'échec, la commande fautive et sa correction attendue sont
toujours affichées.

## Autorités statiques et preuves d'exécution

L'inventaire de classification et le plan sont régénérés seulement si leurs sources ont changé.
L'agrégateur compare le plan commité à ses sources sans le réécrire ; un plan absent ou obsolète bloque
la publication, sans réparation implicite du candidat.
Les compteurs ne sont plus une entrée préalable à leur propre exécution : l'agrégateur consolide les
résultats natifs du candidat avec `Scripts/report_test_execution_counts.py --refresh-and-check`, écrit
`reports/test-execution-counts.json`, ignoré par Git, puis applique les vérifications strictes d'empreinte
et de cohérence existantes. La CI archive ce rapport avec l'inventaire et le plan du même SHA. Le contrôle
direct `--check` reste disponible après exécution ; le profil de développement `pr` ne prétend pas produire un
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
| Commandes préparées par le push massif | 36 | 38 | scan historique et sonde Docker ajoutés, plus smoke complet |
| Un checkpoint suivi d'un push | 52 | 38 | 14 commandes, soit 26,92 % |
| Coût du hook de commit | 92,233 s | médiane 0,071433 s | environ 92,16 s par checkpoint |
| Sortie du hook | 197 lignes / 12 593 octets | 0 / 0 | 100 % |
| Affichage du plan de push | 40 lignes / 12 741 octets | 2 lignes / 260 octets | 95 % des lignes, 97,96 % des octets |
| Scope, sans validation | absent | médiane 0,266561 s ; 3 lectures Git | dérive détectée avant les suites |
| Bootstrap Python d'un worktree neuf, cache pip chaud | manuel après l'échec | 44,674 s, automatiquement à la création | installation déplacée avant toute gate |
| Préflight Python idempotent | absent | médiane 1,848872 s ; p95 2,938926 s sur 11 passages | 0 installation, 0 ligne / 0 octet de sortie |
| Validations canoniques pour le scénario `.venv` absent | 2 tentatives, dont 1 perdue | 1 tentative | 1 tentative perdue supprimée, soit 100 % |
| Réparation manuelle entre deux push | 1 | 0 | geste intermédiaire supprimé |

Le temps avant est un échantillon réussi de la gate `fast` massive. Les médianes après proviennent de
11 mesures ; la sortie du plan compact final de 38 commandes a été relevée à 49 chemins et peut varier
avec le périmètre. Le scope final produit 4 lignes / 477 octets, sans validation ni génération.
Le relevé précédent à 43 chemins reste conservé : hook 0,069695 s, scope 0,269485 s et plan 260 octets.
Le plan intermédiaire passait de 52 à 37 commandes par cycle, soit 15 commandes et 28,85 % de moins.
Les autres mesures intermédiaires conservées étaient : hook 0,070232 s, scope 0,252394 s et plan compact
282 octets à 19 fichiers. Le premier relevé de scope avait pris 0,297 s pour 4 lignes et 526 octets.
Ces nombres ne prédisent pas la durée du profil complet. L'audit, les tests de migration et les
régénérations statiques nécessaires sont un coût ponctuel, distinct du coût de chaque contribution.
Aucune exécution complète n'est nécessaire pour régénérer les compteurs avant la validation canonique.

Les mesures du bootstrap ont été prises sur le même poste Windows, Python 3.12.10, avec le SHA-256
`4e374d210b76…` de `requirements.txt`. Le temps à froid est celui rapporté par le bootstrap réel de ce
worktree ; les 11 temps chauds couvrent le helper de hook, la sonde d'interpréteur, la comparaison
d'empreinte et `pip check`. Le gain de publication est mesuré d'abord en tentatives, car aucun relevé mural
homologue du run historique perdu faute de `.venv` n'a été conservé : le gain temporel net vaut la durée de
ce run échoué moins le préflight chaud médian de 1,848872 s. L'installation n'est pas présentée comme
supprimée ; elle est automatisée et déplacée au point où son échec ne peut encore gaspiller un canonique.

Le candidat intermédiaire `82d5c643` a été refusé en 137,715 s, avant tout transfert : une empreinte de
décision, une projection descriptive et une attente CLI obsolètes causaient 31 échecs Python. Ce coût
appartient à la migration, pas au gain récurrent. La remise à jour de l'autorité de dépendances a pris
2,220 s et celle de la projection descriptive du coût de changement 1,270 s. Aucun seuil ni dette autorisée
du ratchet de maintenabilité n'a été relevé. Les résultats natifs de cet échec ne valent pas preuve du
candidat corrigé, qui reçoit un nouveau SHA et sa propre validation canonique.

Le candidat intermédiaire `9389629` a ensuite été refusé uniquement pour indisponibilité de l'API Docker,
après 1 048 tests Pytest, 838 tests Vitest et 32 E2E verts. Cette tentative a pris 152,688 s et produit
441 lignes, soit 30 733 octets ; les relevés sont conservés sous
`.tmp/contribution-measures/canonical-push-2.*`. Le moteur a été rétabli. Cet échec de migration motive la
sonde de disponibilité placée au préflight du plan final de 38 commandes, afin de détecter ce blocage avant
les suites. Le smoke complet reste inchangé ; ces résultats intermédiaires ne prouvent pas la conformité
du nouveau candidat et ne mesurent pas la durée de son plan final.
