# Feature 9 — Rejouer les prévisions dans le temps et les calibrer

**Description :** reconstruire les états historiques d’une livraison passée, rejouer les prévisions à
plusieurs dates d’observation sans fuite d’information future et confronter leur trajectoire de crédibilité
au résultat réel.

**Flux de valeur :** distinguer une simulation ponctuelle techniquement calculable d’une méthode
empiriquement calibrée pour soutenir une décision.

**Backlog :** [`../backlog.md`](../backlog.md)

## Positionnement et limites

La simulation ponctuelle est une capacité actuelle. L'audit rétrospectif décrit ici est une orientation
stratégique future et ne doit pas être présenté comme livré.

Pour une livraison passée, l'audit doit :

1. reconstruire plusieurs dates d'observation ;
2. figer à chaque date les seules données qui étaient alors disponibles ;
3. rejouer la prévision avec une seed et des versions identifiables ;
4. construire la trajectoire de crédibilité de la prévision ;
5. confronter chaque état au résultat finalement observé.

Le monitoring continu, la collecte permanente et les alertes en temps réel sont hors périmètre. L'audit
peut s'appuyer sur un historique reconstruit à la demande ; il ne suppose pas un dispositif permanent.

## Dépendances d'entrée

- **Feature 2 — fiabilité statistique :** moteur déterministe, contrats statistiques versionnés et résultats
  comparables ;
- **Feature 8 — cohérence temporelle des données :** reconstruction fiable des semaines, périodes
  partielles et informations disponibles à chaque date ;
- **Feature 9 — logique métier :** protocole, rejeu, confrontation, diagnostics et calibration ;
- **Feature 10 — expérience et restitution :** configuration, progression, historique, comparaison, UI,
  PDF, export et cache local ;
- **Feature 11 — exécution :** jobs asynchrones uniquement lorsque les benchmarks en démontrent la nécessité.

La dépendance se lit `Feature 2 → Feature 8 → Feature 9 → Feature 10 / Feature 11`. La Feature 11 n'est pas
un préalable global à l'audit.

## Attendus par PBI

### 9.1 — Définir le protocole de backtesting sans fuite d'information future

- définir la date d'observation et la date du résultat observé ;
- interdire l'usage de données créées, révisées ou clôturées après la date d'observation ;
- définir les règles de gel des paramètres, seeds, versions du moteur et du contrat statistique ;
- documenter les biais de sélection, de survivance et de disponibilité des données ;
- produire un protocole reproductible avant toute interprétation des résultats.

### 9.2 — Reconstruire les états historiques et les points de rejeu

- reconstruire, pour chaque point de rejeu, l'état qui aurait été visible à cette date ;
- traiter explicitement semaines incomplètes, révisions tardives, données manquantes et changements de
  périmètre ;
- définir une stratégie de points de rejeu réguliers ou événementiels sans utiliser le résultat futur pour
  les choisir ;
- associer à chaque état une empreinte de données vérifiable.

### 9.3 — Rejouer les prévisions et construire la trajectoire de crédibilité

- exécuter les modes et scénarios retenus avec leurs fenêtres historiques ;
- conserver seed, paramètres, versions et empreinte de données pour rendre le rejeu interprétable ;
- produire une série temporelle comparable de percentiles, dispersion, complétion et diagnostics ;
- distinguer variation liée aux données, à la fenêtre, au scénario et au bruit de simulation.

### 9.4 — Confronter les prévisions aux résultats observés

- relier chaque prévision à un résultat dont la définition est identique et vérifiable ;
- mesurer écarts, couverture et franchissement des percentiles selon le mode ;
- préserver les censures et les résultats non observables au lieu de les convertir artificiellement ;
- séparer erreur de prévision, indisponibilité des données et changement réel de périmètre.

### 9.5 — Diagnostiquer stabilité, volatilité, dérive et rupture

- mesurer la stabilité et la volatilité de la trajectoire ;
- détecter dérives progressives et ruptures de régime ;
- contextualiser les signaux sans transformer une coïncidence temporelle en causalité ;
- rendre visibles les diagnostics non calculables ou insuffisamment étayés.

### 9.6 — Mesurer délai de détection, faux signaux et robustesse

- mesurer le délai entre un changement observable et sa détection ;
- quantifier les faux signaux et les détections manquées ;
- tester la robustesse aux points de rejeu, seeds, scénarios, fenêtres et données manquantes ;
- éviter tout seuil universel sans validation empirique.

### 9.7 — Calibrer les percentiles et comparer les fenêtres historiques

- mesurer la couverture empirique de chaque percentile ;
- comparer fenêtres récentes, longues et alternatives sur les mêmes cas ;
- rechercher sous-confiance, surconfiance et instabilité de calibration ;
- documenter les conditions dans lesquelles une fenêtre ou un percentile soutient réellement la décision ;
- ne sélectionner aucun réglage sur les mêmes observations que celles utilisées pour l'évaluer sans
  protocole de séparation explicite.

### 9.8 — Formaliser la synthèse métier et décider empiriquement du Risk Score

- définir le contrat de synthèse de la trajectoire, du résultat réel, des diagnostics et de leurs limites ;
- exposer les comparaisons métier entre points de rejeu, scénarios, fenêtres et percentiles ;
- inclure données manquantes, censures, versions, paramètres et hypothèses nécessaires à l'interprétation ;
- fournir ce contrat métier aux restitutions UI, PDF et export portées par la Feature 10, sans les
  implémenter dans la Feature 9.

## Décision empirique attendue sur le Risk Score

- tester sa relation avec les écarts réellement observés ;
- mesurer sa stabilité selon le mode, `n_sims` et la fenêtre historique ;
- vérifier sa valeur supplémentaire par rapport à P50, P90 et aux diagnostics ;
- calibrer les seuils de lecture ;
- le renommer en « Indice de dispersion » si aucune interprétation empirique du risque n’est démontrée ;
- le retirer s’il n’améliore pas la décision.

La décision ne doit pas être prise avant les résultats du backtesting et ne doit pas modifier
rétroactivement les résultats historiques sans version explicite du contrat statistique.

## Preuves attendues

- corpus de livraisons et points de rejeu dont la provenance est démontrable ;
- rapport d'absence de fuite d'information future ;
- résultats reproductibles à empreinte, paramètres, seed et versions identiques ;
- métriques de stabilité, volatilité, dérive, rupture, délai de détection, faux signaux, robustesse et
  calibration ;
- limites, biais et cas non concluants explicitement documentés.
