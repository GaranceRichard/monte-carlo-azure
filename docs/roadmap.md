# Roadmap

Monte Carlo Azure est un outil d’aide à la décision pour la planification sous incertitude.
Cette roadmap exprime les priorités en termes de valeur livrée et de confiance décisionnelle ;
elle ne constitue pas un backlog technique.

---

## Déjà livré — Rendre les projections et leurs limites lisibles

- Simulation Monte Carlo à partir du throughput réel Azure DevOps, en mode équipe et portefeuille,
  pour répondre aux questions « en combien de temps ? » et « combien d’items en N semaines ? ».
- Restitutions interface et PDF des percentiles, distributions, censures à l’horizon et `Risk Score`,
  avec export CSV du throughput et rapports directement téléchargeables.
- Quatre hypothèses d’agrégation portefeuille comparables : `Independant`, `Arrime`, `Friction` et
  `Historique corrélé`.
- Comparaison de crédibilité des hypothèses portefeuille : la qualité des données historiques, la
  stabilité des résultats simulés et la crédibilité de l’hypothèse sont trois diagnostics distincts.
- Types de preuve explicites : `observed`, `calculated`, `user_input` et `unsupported`.
- Absence de recommandation automatique lorsqu’aucune preuve ne permet de privilégier une hypothèse :
  cette conclusion est un résultat métier, pas une erreur à masquer.
- Distinction entre une recommandation fondée sur les données et une référence de pilotage choisie par
  l’utilisateur ; cette dernière est facultative et ne modifie ni les calculs ni la crédibilité attribuée
  aux scénarios.
- Connexion Azure DevOps Cloud et Server/TFS depuis le navigateur, sans faire transiter le PAT ou le
  contexte Azure DevOps par le backend.
- Contrôles qualité adaptatifs livrés avec trois niveaux explicables (`targeted`, `impacted`, `massive`) :
  le pré-commit valide l’index Git, le pré-push valide les commits poussés dans des worktrees détachés et
  la CI conserve le plan complet avec smoke test Docker.
- Chaîne de couverture fiabilisée : suppression des doubles exécutions, seuils E2E réellement bloquants,
  artefacts identifiés et réutilisés par les Vitals, et temporaires Pytest isolés dans le workspace.
- Documentation normative réalignée sur les gates, la couverture, la traçabilité et les critères de
  validation complète, de conformité DoD et de publiabilité.

---

## Maintenant — Fiabiliser les données qui fondent l’arbitrage

**Une baseline de performance reproductible**

Établir une baseline de performance reproductible afin de mesurer les régressions de façon comparable et
de prioriser les optimisations sur des faits, maintenant que la chaîne de validation adaptative est en
place.

*Valeur : préserver la confiance dans les projections, les exports et les parcours critiques tout en
disposant d’un repère objectif de vitesse et de capacité.*

**Une collecte Azure DevOps qui ne mélange pas les signaux**

Fiabiliser la collecte Azure DevOps en découplant clairement le throughput et le cycle time : chacun doit
conserver sa définition, ses sources et ses limites de qualité. Intégrer les limites de sprint disponibles
dans Azure DevOps Cloud et Server, sans dégrader la compatibilité entre les deux environnements.

*Valeur : éviter qu’un indicateur de flux ou de délai ne soit interprété à partir de données incomplètes,
ou d’une règle de sprint implicite.*

**Des limites de sprint visibles au moment de décider**

Restituer les limites de sprint Azure DevOps dans l’interface et dans les PDF, avec une formulation qui
permet de comprendre leur effet sur la lecture de la projection et du portefeuille.

*Valeur : rendre les hypothèses de capacité vérifiables en comité, au même titre que les percentiles et
les diagnostics déjà affichés.*

---

## Ensuite — Renforcer la robustesse des prévisions et préparer la croissance

**Des projections vérifiables dans le temps**

Renforcer la robustesse statistique avec des contrats cohérents entre Python et TypeScript, du backtesting
des hypothèses et des diagnostics de concentration de fin de sprint. Compléter cette lecture par la
comparaison de périodes, afin d’identifier l’effet d’un changement d’organisation, de périmètre ou
d’onboarding sur le delivery.

*Valeur : distinguer une projection calculable d’une projection dont les hypothèses restent crédibles face
aux résultats observés.*

**Un socle qui évolue sans fragiliser le produit**

Restructurer progressivement l’architecture afin d’isoler les responsabilités métier et de conserver les
invariants de sécurité. Optimiser les performances à partir de la baseline et préparer le passage à
l’échelle des simulations, de la collecte et de la génération de rapports.

*Valeur : maintenir une expérience fluide et des résultats cohérents lorsque les volumes, les équipes et
les usages augmentent.*

**Des restitutions adaptées aux instances existantes**

Ajouter des exports structurés pour les outils de reporting programme lorsque les décisions doivent être
réutilisées au-delà du PDF de comité.

*Valeur : réduire la préparation manuelle des instances de gouvernance sans dupliquer les chiffres ou les
hypothèses.*

---

## Plus tard — Faire du portefeuille un outil d’arbitrage de programme

**Un portefeuille qui explicite les relations entre équipes**

Enrichir le pilotage portefeuille avec les dépendances, contraintes, règles de substituabilité et diagnostics
multi-équipes. Les scénarios actuels rendent les hypothèses comparables ; cette étape rendra visibles les
relations opérationnelles qui peuvent les justifier, les limiter ou les invalider.

*Valeur : anticiper les effets de cascade et rendre les arbitrages de ressources plus explicites avant que
les retards ne se matérialisent.*

**Une vue direction de programme**

Consolider plusieurs projets dans une vue de portefeuille avec des niveaux de risque, des contraintes et des
signaux de maturité comparables. Cette vue s’appuiera sur les diagnostics d’historique, de prévision et de
crédibilité, sans les réduire à un score unique.

*Valeur : permettre aux directions programme et transformation d’arbitrer priorités et capacité sur une
base probabiliste commune, tout en conservant les limites des données visibles.*

---

## Ce qui ne fait pas partie de la roadmap

- gestion de backlog : l’outil lit Azure DevOps, il ne le remplace pas ;
- estimation par story points : le modèle repose intentionnellement sur le throughput réel ;
- garantie de résultat : l’outil structure l’incertitude, il ne l’élimine pas.
