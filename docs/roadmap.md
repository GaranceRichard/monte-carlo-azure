# Roadmap

Monte Carlo Azure est un outil d'aide a la decision pour la planification sous incertitude.
Cette roadmap exprime les priorites en termes de valeur delivree, pas de features techniques.

---

## Maintenant — Outil operationnel pour une equipe ou un portefeuille

**Ce qui est disponible**

- Simulation Monte Carlo a partir du throughput reel Azure DevOps
- Deux modes de question : "en combien de temps ?" et "combien d'items en N semaines ?"
- Mode portefeuille multi-equipes avec 4 scenarios d'agregation (Optimiste, Arrime, Friction, Conservateur)
- Rapport PDF exportable, oriente restitution en COPIL
- Risk Score avec code couleur pour qualifier la fiabilite de la projection
- Aucune donnee d'identification Azure DevOps ne transite par le serveur

**Ce que ca permet**

Arriver en comite avec une projection chiffree et un niveau de confiance explicite, plutot qu'une estimation subjective. Arbitrer scope et delai sur une base commune, pas sur des intuitions divergentes.

---

## Ensuite — Renforcer la lecture decisionnelle dans le temps

**Comparaison de periodes**

Permettre de comparer le throughput avant et apres un evenement organisationnel (reorganisation, changement de perimetre, onboarding). Aujourd'hui l'outil donne une photo ; cette evolution donne un film.

*Valeur : identifier si une decision passee a ameliore ou degrade la capacite de delivery, avec des donnees.*

**Indicateur de stabilite du throughput**

Signaler explicitement quand l'historique est trop volatile pour produire une projection fiable. Aujourd'hui le Risk Score mesure la dispersion du resultat ; cet indicateur mesurerait la qualite de la donnee source.

*Valeur : eviter les fausses certitudes. Un directeur de projet doit savoir quand ne pas s'appuyer sur une simulation.*

**Export structure pour reporting existant**

Produire un export compatible avec les formats de reporting programme (Excel, PowerPoint). Aujourd'hui le PDF est oriente COPIL ; cet export ciblerait l'integration dans un tableau de bord existant.

*Valeur : reduire le temps de preparation des instances de gouvernance.*

---

## Plus tard — Vision direction de programme

**Dashboard multi-projets**

Consolider plusieurs projets en une vue unique avec niveaux de risque compares. Passer de "chaque equipe a sa simulation" a "la direction a une lecture agregee du portefeuille programme".

*Valeur : permettre a une direction de programme d'arbitrer les priorites et les ressources sur une base probabiliste commune.*

**Visualisation des dependances inter-equipes**

Modeliser l'impact d'un retard d'une equipe sur les autres. Le mode portefeuille actuel suppose l'independance des equipes ; cette evolution leve cette hypothese.

*Valeur : anticiper les effets de cascade avant qu'ils se produisent, pas apres.*

**Indicateur de maturite de delivery par equipe**

Produire un score de maturite base sur la stabilite du throughput dans le temps, la predictibilite des engagements et la qualite des donnees ADO. Utilisable pour un diagnostic portefeuille ou un accompagnement transformation.

*Valeur : donner aux responsables transformation un instrument de mesure objectif de la progression des equipes.*

---

## Ce qui ne fait pas partie de la roadmap

- Gestion de backlog : l'outil lit Azure DevOps, il ne le remplace pas
- Estimation par story points : le modele repose intentionnellement sur le throughput reel
- Garantie de resultat : l'outil structure l'incertitude, il ne l'elimine pas
