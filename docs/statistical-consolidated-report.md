# Rapport consolidé de conformité statistique

Le rapport consolidé fournit une autorité unique de lecture des preuves statistiques déjà produites. Son
JSON canonique est [`reports/statistical-consolidated-report.json`](../reports/statistical-consolidated-report.json) ;
la synthèse [`reports/statistical-consolidated-report.md`](../reports/statistical-consolidated-report.md) est
générée depuis le même modèle. Ce rapport ne redéfinit aucune règle de `STD-STAT-001`.
Il ne recalcule aucun résultat statistique d’autorité et ne remplace aucun artefact spécialisé.

## Sources consommées

Le générateur lit et vérifie les autorités suivantes sans appeler les moteurs ni relancer la calibration :

- `STD-STAT-001` version `1.0` et les vecteurs `mca-prng-v1` ;
- le corpus `mca-statistical-reference-corpus` version `1.0` et les 22 sondes de validation ;
- le rapport déterministe de parité `1.1` ;
- la preuve de rejeu exact `1.0` ;
- le protocole `mca-statistical-distributional-parity` version `1.0`, sa population de seeds et sa
  calibration ;
- la preuve distributionnelle `1.0` ;
- la preuve de compatibilité statistique `1.0`, issue de l’autorité fermée des composants, décisions et
  traitements historiques.

Chaque entrée de `sources` conserve un chemin relatif stable, l’identité et la version déclarées, le
contrat de validation, le SHA-256 des octets consommés, l’empreinte canonique embarquée lorsqu’elle existe
et un statut explicite. Les schémas du corpus, des sondes, du rapport de parité, du rejeu exact, du
protocole, des seeds, de la calibration, de la preuve distributionnelle et du rapport consolidé sont
versionnés sous `contracts/`. Le schéma de la preuve de compatibilité et celui de son autorité y sont aussi
versionnés.

La validation porte sur la forme fermée, la version, les identités corpus/standard/PRNG/protocole, la
complétude et les compteurs spécialisés, les empreintes embarquées, les cas et scénarios attendus, puis la
cohérence mutuelle des métadonnées. Une source absente, périmée, corrompue, incompatible ou illisible reste
dans le rapport avec son diagnostic ; aucune valeur manquante n’est reconstruite depuis une autre preuve.

## Niveaux de preuve conservés

Le modèle sépare six niveaux qui ne se compensent pas :

1. conformité algorithmique et normative de chaque moteur aux résultats du corpus ;
2. validation du contrat fermé et des sondes partagées ;
3. rejeu exact interlangage sur le corpus et les versions déclarées ;
4. indépendance du batching pour les quatre géométries consignées ;
5. parité distributionnelle sur les scénarios, cohorts, métriques, marges et puissance du protocole ;
6. compatibilité des versions, empreintes sémantiques, décisions, preuves et traitements historiques.

Les synthèses par cas gardent séparément le statut normatif, le statut de rejeu exact et l’indépendance du
batching. Les synthèses distributionnelles gardent scénario source, mode, taille de cohort, simulations,
vue, verdict et compteurs de métriques. Les limites restent attachées à leur niveau de preuve.

## Règle de verdict

Le verdict est la classification observée de priorité la plus élevée :

1. `infrastructure_error` ;
2. `protocol_error` ;
3. `invalid_evidence` ;
4. `version_incompatibility` ;
5. `engine_error` ;
6. `normative_divergence` ;
7. `interlanguage_divergence` ;
8. `distributional_divergence` ;
9. `statistically_inconclusive` ;
10. `match`.

Tous les diagnostics sont conservés et triés déterministement même lorsqu’un diagnostic de priorité
supérieure fixe le verdict. Ainsi, un rejeu exact conforme n’annule pas un résultat distributionnel non
concluant ; une incompatibilité de version ne devient pas une divergence fonctionnelle ; une absence de
divergence ne devient pas une preuve d’équivalence ; une erreur d’infrastructure ne devient pas un défaut
statistique.

Un diagnostic conserve, lorsqu’ils existent dans la preuve spécialisée, source, niveau, cas, scénario ou
fixture, règle ou métrique, moteur, cohort ou batch, JSON Pointer, attendu, obtenu, seuil, intervalle, marge,
classification et conséquence sur la consolidation.

## Déterminisme et enforcement

`generation.source_set_sha256` identifie le snapshot logique des sources et de leurs schémas.
`integrity.content_sha256` est calculé sur le JSON canonique trié, sans son propre champ d’empreinte. Aucune
partie canonique ne contient de chemin absolu, d’horodatage mural, d’identifiant temporaire ou de donnée
dépendante de la machine. À sources identiques, JSON, Markdown et empreintes sont identiques.

Le rapport est `informational` et n’ajoute aucun blocage de parité au profil `main`. La commande retourne
toutefois un code non nul lorsqu’une source obligatoire ou son schéma est absent, invalide ou corrompu,
lorsqu’une empreinte est fausse, lorsque les métadonnées sont incohérentes ou incompatibles, ou lorsqu’une
erreur de protocole, moteur ou infrastructure rend la preuve inexploitable. Une divergence fonctionnelle
ou un résultat statistiquement non concluant reste visible sans transformer ce PBI en enforcement complet.
Le validateur spécialisé de compatibilité demeure, lui, bloquant lorsqu’il est exécuté directement.

```powershell
.venv\Scripts\python.exe Scripts\generate_statistical_consolidated_report.py
.venv\Scripts\python.exe Scripts\validate_statistical_consolidated_report.py
```

## Limites

Le rejeu exact ne prouve que le corpus et les versions déclarées. La preuve distributionnelle ne porte que
sur ses scénarios, cohorts, métriques, marges et puissance documentés et ne devient jamais une preuve
exacte. Le rapport ne constitue ni un backtesting empirique Azure DevOps, ni une équivalence universelle,
ni une décision de migration à la place de l’autorité de compatibilité. L’enforcement complet dans `main`
appartient au PBI 2.21.
