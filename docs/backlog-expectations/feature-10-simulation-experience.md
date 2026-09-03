# Feature 10 — Disposer d’une expérience de simulation cohérente et de restitutions fiables

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés.

## Périmètre

La Feature 10 porte :

- la configuration d'une simulation ponctuelle ou d'un futur audit rétrospectif ;
- la progression présentée à l'utilisateur, quel que soit le mode d'exécution ;
- l'historique local, la comparaison des exécutions et le rejeu par seed ;
- la transformation déterministe des résultats et diagnostics disponibles en recommandations d’équipe et de
  portefeuille directement exploitables ;
- les restitutions UI, PDF et export ;
- le cache local et ses migrations.

Elle ne porte ni le protocole de backtesting et de calibration de la Feature 9, ni l'infrastructure de jobs,
workers, annulation et reprise de la Feature 11.

Statut : À raffiner avant engagement.

Les modèles de présentation, leurs API, la séparation UI-rapports et les contrôles interdisant les calculs
métier dans les rendus sont des fondations livrées par la Feature 7. La Feature 10 conserve l’expérience
utilisateur, le contenu et la pagination PDF, les téléchargements, l’accessibilité, les formulations, la
cohérence visuelle et les comportements fonctionnels des exports. Elle devra raffiner ces ancres avant
engagement sans redécouper les frontières architecturales.

## Contrat de recommandation décisionnelle

Une recommandation ne se réduit ni à un diagnostic, ni à un libellé générique. Pour une même exécution et les
mêmes choix de gouvernance, elle produit de façon déterministe un tuple traçable :

1. une décision principale qui nomme l’engagement d’équipe avec sa valeur, son unité, son horizon et son
   repère probabiliste, ou le scénario de portefeuille à retenir, ou explicitement l’abstention ;
2. un niveau de confiance qui distingue le repère probabiliste nominal de la simulation et la solidité
   qualitative de l’appui disponible ;
3. une alternative prudente applicable, soit un délai plus long ou un volume plus faible pour l’équipe, soit
   une enveloppe ou une référence de pilotage conservatrice pour le portefeuille ;
4. une justification qui compare la décision principale à cette alternative et relie le choix aux résultats,
   à la qualité des données, à l’incertitude, aux censures, à la sensibilité et aux hypothèses disponibles.

Lorsque les résultats requis manquent ou que les diagnostics interdisent une décision défendable, « ne pas
engager » ou « ne privilégier aucun scénario » constitue une décision explicite. Aucune valeur absente ne peut
être remplacée par zéro ou inventée pour compléter le tuple.

Le niveau de confiance décisionnelle est qualitatif et non calibré. Un percentile `Pxx` reste un repère issu
de la distribution simulée, conditionnel aux données, à la fenêtre et aux hypothèses ; il ne signifie pas
`xx %` de réussite réelle. La Feature 10 ne peut qualifier un réglage, un modèle ou un scénario de « calibré »,
« validé » ou « empiriquement supérieur » sans consommer une preuve produite par la Feature 9. Le `Risk Score`
peut contribuer à expliquer la dispersion, mais ne suffit jamais à choisir ou à justifier la recommandation.

Pour le portefeuille, stabilité de simulation, corrélation historique et taux d’alignement saisi restent
respectivement un calcul, une observation et une convention utilisateur. Si ces éléments ne départagent pas
la crédibilité future des hypothèses, la recommandation refuse de désigner un meilleur modèle. Elle peut
nommer une référence choisie comme convention de pilotage et une enveloppe prudente, sans les présenter comme
preuves de supériorité.

La recommandation appartient au résultat actif : son identité conserve la configuration et la provenance de
l’exécution dont elle découle. Invalider ce résultat invalide aussi sa recommandation. Les PBI de restitution
consomment le même modèle de recommandation dans l’interface, le PDF et les exports, sans recalculer le choix,
la confiance, l’alternative ou la justification dans un rendu.

La dépendance `Feature 9 → Feature 10` concerne l’enrichissement empirique et la restitution du futur audit.
Elle ne bloque pas la recommandation non calibrée d’une simulation ponctuelle fondée sur les résultats et
diagnostics déjà disponibles.

## Cache local

Pour l'audit rétrospectif futur, la clé conceptuelle du cache est :

```text
empreinte des données + paramètres + seed + version moteur + version contrat statistique
```

Une entrée n'est réutilisable que si ces cinq dimensions sont identiques. La configuration affichée,
l'historique et les comparaisons doivent conserver les informations nécessaires pour expliquer une
invalidation ou une réutilisation.

## Restitution de l'audit futur

L'expérience devra rendre lisibles les points de rejeu, la trajectoire de crédibilité, la confrontation au
résultat réel, les diagnostics temporels et la calibration sans les présenter comme une surveillance en
temps réel. Une progression UI n'implique pas à elle seule une exécution asynchrone.

## 10.5 — Engagement d’équipe recommandé avec confiance et repli prudent

- **Taille :** S
- **Outcome :** Chaque résultat d’équipe exploitable fournit un engagement chiffré ou un refus d’engager avec son niveau de confiance, son repli prudent et une justification comparative.
- **Raison principale de changer :** Transformer la projection d’équipe en décision de planification directement applicable.
- **Frontière principale :** Synthèse décisionnelle du parcours équipe.
- **Famille d’invariants :** Fidélité, prudence et traçabilité de la recommandation d’équipe.
- **Preuve principale :** Tests de décision couvrant les deux modes, les niveaux d’appui et les résultats incomplets.
- **Éléments de réalisation inclus :** Contrat de recommandation équipe ; table de décision versionnée ; engagement principal ; repère probabiliste nominal et appui qualitatif ; alternative prudente ; justification chiffrée ; refus d’engager ; provenance des facteurs ; tests et documentation.
- **Hors périmètre :** Calibration empirique des percentiles et des seuils relevant de la Feature 9, choix d’un scénario portefeuille, pagination PDF et infrastructure asynchrone.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 2.20, 7.30, 7.52, 7.60, 7.66, 8.14
- **Critères de clôture :** Pour les modes délai et capacité, la même entrée produit la même recommandation, le choix principal indique valeur, unité, horizon et repère probabiliste, le repli est réellement plus prudent, la justification compare les deux options et cite les facteurs décisifs, toute donnée indispensable absente conduit à un refus explicite sans valeur fabriquée, et aucun niveau nominal n’est présenté comme calibré dans le réel.

Cas vérifiables minimaux :

- en mode délai, une alternative prudente ne peut être antérieure à l’engagement principal ;
- en mode capacité, une alternative prudente ne peut promettre davantage d’items ;
- les censures et percentiles non identifiables restent visibles et peuvent empêcher l’engagement ;
- le niveau qualitatif prend au minimum les états `supportable`, `sous précautions`, `arbitrage humain requis`
  et `non recommandable` ;
- la justification nomme les valeurs comparées et ne se limite pas à une liste générique d’avertissements.

## 10.6 — Choix de scénario portefeuille explicite, prudent et justifié

- **Taille :** S
- **Outcome :** Chaque comparaison portefeuille fournit un scénario décisionnel ou une abstention explicite avec son niveau de confiance, une option prudente et une justification comparative.
- **Raison principale de changer :** Transformer la comparaison de scénarios en arbitrage portefeuille directement applicable.
- **Frontière principale :** Synthèse décisionnelle du parcours portefeuille.
- **Famille d’invariants :** Fidélité, prudence et traçabilité de la recommandation portefeuille.
- **Preuve principale :** Tests de décision couvrant sélection, convention de pilotage, prudence et preuves insuffisantes.
- **Éléments de réalisation inclus :** Contrat de recommandation portefeuille ; table de décision versionnée ; scénario retenu ou abstention ; nature de l’appui ; niveau qualitatif ; option ou enveloppe prudente ; comparaison des résultats ; justification ; provenance des preuves et conventions ; tests et documentation.
- **Hors périmètre :** Preuve empirique de supériorité et calibration relevant de la Feature 9, relations opérationnelles relevant de la Feature 12, mise en page des restitutions et infrastructure asynchrone.
- **Surface prévisionnelle :** 4 fichiers de production ; 8 fichiers versionnés
- **Prédécesseurs :** 2.20, 7.30, 7.53, 7.61, 7.66, 8.14
- **Critères de clôture :** La même comparaison et le même choix de gouvernance produisent la même recommandation, toute sélection nomme le scénario et la nature de son appui, l’option prudente est déterminée dans le sens défavorable de la métrique, la justification compare les options et leurs limites, et des preuves insuffisantes produisent une abstention exploitable sans prétendre qu’un modèle est empiriquement supérieur.

Cas vérifiables minimaux :

- une référence choisie par l’utilisateur reste une convention de pilotage et ne devient pas une préférence
  issue des preuves ;
- le scénario donnant le résultat le plus prudent peut borner la décision sans être déclaré plus crédible ;
- l’absence de scénario départageable nomme la démarche applicable, l’enveloppe prudente et les preuves à
  acquérir plutôt qu’un vainqueur artificiel ;
- la justification distingue faits observés, résultats calculés, saisies utilisateur et preuves absentes ;
- le `Risk Score` ou la seule stabilité d’une distribution ne peut décider du scénario.

## 10.12 — Téléchargements de restitution compréhensibles et accessibles

Les parcours de téléchargement doivent :

- annoncer clairement le format et le contenu produit ;
- rendre l’action accessible au clavier et aux technologies d’assistance ;
- conserver un diagnostic utile lorsque la restitution échoue ;
- ne pas dupliquer les mappers ou les moteurs de rendu de la Feature 7.
