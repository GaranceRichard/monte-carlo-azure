# Roadmap

Monte Carlo Azure est un outil d’aide à la décision pour la planification sous incertitude.
Cette roadmap exprime une trajectoire produit orientée valeur et confiance décisionnelle ;
elle ne constitue pas un backlog technique ni une promesse de calendrier.

---

## Déjà livré — Rendre les projections et leurs limites lisibles

- Simulation Monte Carlo à partir du throughput réel Azure DevOps, en mode équipe et portefeuille,
  pour répondre aux questions « en combien de temps ? » et « combien d’items en N semaines ? ».
- Contrat de simulation borné, tirages reproductibles par `seed` et traitement explicite des censures
  lorsque le backlog n’est pas terminé à l’horizon.
- Restitutions dans l’interface et les PDF des percentiles, distributions et diagnostics, avec export CSV
  du throughput et rapports directement téléchargeables.
- Qualité des données, incertitude de prévision et recommandation d’arbitrage séparées du `Risk Score` ;
  lorsque des historiques locaux comparables existent, la sensibilité entre période récente et période
  longue complète cette lecture.
- Quatre hypothèses d’agrégation portefeuille comparables : `Indépendant`, `Arrimé`, `Friction` et
  `Historique corrélé`, avec une lecture distincte de la qualité des historiques, de la stabilité des
  résultats simulés et de la crédibilité de chaque hypothèse.
- Aucune recommandation automatique de scénario lorsque les preuves sont insuffisantes. Une référence de
  pilotage peut être choisie comme convention de gouvernance, sans modifier les calculs ni la crédibilité
  attribuée aux hypothèses.
- Connexion Azure DevOps Cloud et Server/TFS depuis le navigateur, sans faire transiter le PAT ou le
  contexte Azure DevOps par le backend. Le throughput et le `Cycle Time` conservent des définitions, des
  sources et des unités distinctes.
- Chaîne qualité adaptative et contrôles de couverture livrés, avec traçabilité des points vitaux et
  critères distincts pour la validation complète, la conformité DoD et la publiabilité.

---

## Maintenant — Maîtriser le coût de changement avant les prochaines capacités

**Architecture explicite et coût de changement maîtrisé**

Faire évoluer incrémentalement le produit vers une architecture hexagonale pragmatique qui sépare les
préoccupations métier, applicatives, techniques, de présentation et de qualité. Des outcomes cohérents, des
frontières explicites et des contrôles automatiques guideront la réduction progressive des hotspots et les
migrations locales, sans réécriture globale. Cette priorité applique le retour d’expérience du PBI 2.21 :
les garanties statistiques sont désormais bloquantes, mais leur évolution doit pouvoir rester locale,
publiable et démontrable. Le premier résultat attendu est un socle assez clair pour engager ensuite les
capacités de données et de contexte d’itération de la Feature 8.

*Valeur : préserver les garanties statistiques déjà acquises tout en réduisant l’étendue, le risque et le
temps nécessaires à chaque évolution future.*

**Fiabilité des données Azure DevOps**

Continuer à rendre visibles la profondeur d’historique, les collectes partielles et les limites de
complétude, sans confondre qualité du throughput et qualité du `Cycle Time`, et sans fragiliser la
compatibilité Cloud et Server/TFS.

*Valeur : permettre de savoir si les données disponibles soutiennent réellement l’arbitrage avant de lire
la projection.*

**Contexte d’itération observable**

Collecter progressivement les itérations pertinentes sur Azure DevOps Cloud et Server/TFS, puis rendre
leurs limites visibles dans les graphiques et les rapports en signalant les périodes partielles ou
indisponibles. Les variations de throughput et de `Cycle Time` pourront ainsi être mises en regard du
contexte d’itération, tout en conservant des définitions et des sources distinctes pour ces deux mesures.

*Valeur : replacer les variations observées dans leur contexte opérationnel sans transformer une
coïncidence temporelle en relation de causalité.*

**Audit rétrospectif des prévisions**

Préparer une capacité future de backtesting qui, pour une livraison passée, reconstruit plusieurs dates
d'observation, n'utilise à chacune que les données alors disponibles, rejoue la prévision et confronte sa
trajectoire de crédibilité au résultat réel. Le protocole devra prévenir toute fuite d'information future
et mesurer stabilité, volatilité, dérive, rupture, délai de détection, faux signaux, robustesse et
calibration des percentiles et fenêtres.

Cette orientation ne décrit pas une fonctionnalité déjà livrée : le produit actuel reste une simulation
ponctuelle. Elle doit éprouver les hypothèses face aux observations sans transformer la stabilité d'une
distribution en preuve ni sélectionner automatiquement un scénario.

*Valeur : prévoir une livraison puis vérifier rétrospectivement si la crédibilité affichée soutenait
réellement la décision.*

**Performance mesurable**

Établir une baseline reproductible pour la collecte Azure DevOps, les simulations, la génération des
rapports et les parcours utilisateur associés avant de prioriser les optimisations.

*Valeur : préserver des parcours et des exports fiables à mesure que les volumes et les usages augmentent.*

---

## Ensuite — Étendre les restitutions

**Exports pour le reporting programme**

Ajouter des restitutions structurées pour réutiliser les décisions, les chiffres et leurs hypothèses dans
les outils de reporting existants, au-delà des PDF de comité.

*Valeur : réduire la préparation manuelle des instances de gouvernance sans dupliquer ni décontextualiser
les résultats.*

---

## Plus tard — Étendre le pilotage de programme

**Relations opérationnelles entre équipes**

Enrichir le portefeuille avec des dépendances, contraintes et règles de substituabilité explicites. Les
scénarios actuels comparent des hypothèses ; ils ne démontrent pas à eux seuls les relations opérationnelles
qui pourraient les justifier ou les invalider.

*Valeur : rendre les effets de cascade et les arbitrages de ressources discutables sur des éléments
observables.*

**Vue direction de programme**

Consolider plusieurs projets dans une vue commune avec des risques, des contraintes et des signaux de
maturité comparables. Cette vue devra conserver séparées la qualité des données, l’incertitude de prévision,
la crédibilité des hypothèses et la décision humaine, sans les réduire à un score unique.

*Valeur : soutenir les arbitrages de priorité et de capacité à l’échelle programme tout en gardant les
limites des données visibles.*

---

## Hors roadmap

- gestion de backlog : l’outil lit Azure DevOps, il ne le remplace pas ;
- estimation par story points : le modèle repose intentionnellement sur le throughput réel ;
- garantie de résultat : l’outil structure l’incertitude, il ne l’élimine pas.
- monitoring continu, collecte permanente et alertes en temps réel.
