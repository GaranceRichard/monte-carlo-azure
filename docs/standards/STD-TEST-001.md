# Standard de classification, de qualité et de pilotage des tests logiciels

**Référence :** STD-TEST-001
**Version :** 1.0
**Statut :** Standard projet
**Propriétaire :** Responsable technique / Responsable qualité logicielle
**Approbateurs :** Architecture, sécurité, produit et exploitation
**Périmètre :** Tous les composants logiciels, API, interfaces, traitements, scripts, infrastructures et chaînes de données du projet

---

# 1. Objet

Le présent standard définit les exigences applicables à la conception, à la classification, à l’organisation, à l’exécution, au dénombrement et au pilotage des tests logiciels.

Il vise à garantir que la suite de tests soit :

* compréhensible ;
* classifiable ;
* sélectionnable ;
* automatisable ;
* dénombrable ;
* reproductible ;
* stable ;
* proportionnée aux risques ;
* intégrée à la chaîne CI/CD ;
* exploitable pour évaluer le niveau de confiance dans le produit.

Le standard ne limite pas la qualité au nombre de tests ou au taux de couverture du code.

Il impose une lecture simultanément :

* quantitative ;
* qualitative ;
* fonctionnelle ;
* non fonctionnelle ;
* architecturale ;
* opérationnelle ;
* orientée risques.

---

# 2. Champ d’application

Le présent standard s’applique :

* aux nouveaux projets ;
* aux projets existants faisant l’objet d’une modernisation ;
* aux produits frontend, backend ou full stack ;
* aux API ;
* aux applications de bureau ou mobiles ;
* aux traitements de données ;
* aux moteurs de calcul ;
* aux systèmes distribués ;
* aux infrastructures définies sous forme de code ;
* aux outils internes ;
* aux bibliothèques partagées ;
* aux scripts participant à la production ou à la livraison.

Les exigences doivent être appliquées proportionnellement :

* à la criticité du produit ;
* à sa durée de vie ;
* à son exposition ;
* à la complexité métier ;
* à la volumétrie ;
* aux exigences réglementaires ;
* aux conséquences d’une défaillance.

Une dérogation doit être explicite, justifiée, limitée dans le temps et approuvée par le responsable technique.

---

# 3. Terminologie normative

Les termes suivants sont utilisés dans ce standard :

* **DOIT** : exigence obligatoire ;
* **NE DOIT PAS** : interdiction ;
* **DEVRAIT** : pratique attendue, sauf justification documentée ;
* **PEUT** : pratique facultative selon le contexte.

---

# 4. Principes directeurs

## 4.1 La qualité ne se résume pas au volume de tests

Le nombre total de tests constitue un indicateur d’activité.

Il ne démontre pas à lui seul :

* la pertinence des scénarios ;
* la qualité des assertions ;
* la couverture des risques ;
* la qualité de l’architecture ;
* la sécurité ;
* la performance ;
* la résilience ;
* la capacité à détecter une régression.

Toute communication sur la qualité DOIT présenter une lecture ventilée et contextualisée.

La formulation suivante est insuffisante :

> Le projet possède 2 500 tests et 90 % de couverture.

La formulation attendue est de la forme :

> Le projet possède 2 500 cas de test classifiés : 50 % unitaires, 25 % composants, 15 % intégration, 6 % contrats et 4 % E2E. Les parcours critiques sont couverts à 100 %, le taux d’instabilité est de 0,4 %, les contrôles de sécurité couvrent toutes les interfaces publiques et deux scénarios de résilience restent partiellement couverts.

## 4.2 La classification est fondée sur le comportement réel

La nature d’un test DOIT être déterminée selon :

* le périmètre réellement exécuté ;
* les dépendances réellement utilisées ;
* les frontières techniques traversées ;
* les ressources mobilisées ;
* le point d’entrée ;
* le niveau d’assemblage du système.

Le nom d’un test, son répertoire ou son framework ne suffisent pas à établir sa nature.

## 4.3 La classification doit séparer les axes

La nature technique, la finalité, le profil d’exécution, le domaine métier et la criticité décrivent des dimensions différentes.

Ces dimensions NE DOIVENT PAS être mélangées dans une liste unique.

Exemple incorrect :

```text
unitaire
sécurité
performance
intégration
E2E
```

Exemple correct :

```text
Nature principale : intégration
Finalités : sécurité, résilience
Profil d’exécution : nightly
Domaine : authentification
Criticité : élevée
```

## 4.4 Le pilotage est fondé sur les risques

Les tests doivent être conçus en fonction :

* des règles métier critiques ;
* des parcours utilisateurs essentiels ;
* des interfaces techniques ;
* des risques de sécurité ;
* des risques de performance ;
* des risques de défaillance ;
* des risques de migration ;
* des obligations réglementaires.

La quantité de tests ne doit jamais devenir une fin en soi.

## 4.5 Le dénombrement doit être automatisé

Le projet NE DOIT PAS dépendre d’un inventaire manuel pour connaître la composition de sa suite de tests.

La chaîne CI/CD DOIT produire automatiquement les informations nécessaires au reporting.

---

# 5. Règle fondamentale de classification

Chaque test devrait avoir :

* **une seule nature principale** : unitaire, composant, intégration, contrat ou E2E ;
* **une ou plusieurs finalités** : fonctionnel, sécurité, performance, résilience, accessibilité ;
* **un profil d’exécution** : PR, main, nightly, release ;
* éventuellement un domaine métier ou un niveau de criticité.

Cette règle constitue le fondement du dénombrement et du pilotage de la stratégie de test.

Exemple :

```text
Nature principale : intégration
Finalités : fonctionnel, résilience
Profil d’exécution : nightly
Domaine métier : récupération des données
Criticité : élevée
```

---

# 6. Taxonomie des tests

## 6.1 Axe 1 — Nature principale

Chaque test DOIT appartenir à une seule nature principale.

Les natures principales sont mutuellement exclusives :

* unitaire ;
* composant ;
* intégration ;
* contrat ;
* E2E.

Lorsqu’un test mobilise plusieurs couches, le périmètre maximal réellement exécuté détermine sa nature principale.

## 6.2 Test unitaire

Un test est unitaire lorsqu’il vérifie une unité logique isolée sans infrastructure réelle.

Il ne doit normalement pas utiliser :

* une base de données réelle ;
* un accès réseau ;
* un navigateur ;
* un service externe ;
* un système de fichiers persistant ;
* un processus externe ;
* une infrastructure déployée.

Il peut utiliser :

* des objets en mémoire ;
* des stubs ;
* des fakes ;
* des mocks limités aux frontières externes ;
* une horloge contrôlée ;
* des générateurs de données.

Exemples :

* règle métier ;
* calcul ;
* invariant ;
* transformation de données ;
* validation ;
* calcul statistique ;
* cas limite ;
* gestion d’une erreur métier.

Un test n’est pas unitaire uniquement parce qu’il appelle une seule fonction.

Si cette fonction déclenche un accès réel à une base ou à un service, le test est un test d’intégration.

## 6.3 Test de composant

Un test de composant vérifie un module cohérent à travers son interface publique.

Il utilise :

* les collaborations internes réelles ;
* les règles métier réelles ;
* les composants internes réels.

Il remplace généralement :

* les services externes ;
* la persistance distante ;
* les fournisseurs d’identité ;
* les API tierces ;
* les files externes.

Exemples :

* service applicatif complet ;
* moteur de calcul ;
* hook frontend ;
* module de génération de rapport ;
* composant d’interface avec ses sous-composants ;
* contrôleur avec logique applicative réelle.

Le test de composant se distingue du test unitaire par son périmètre plus large et du test d’intégration par l’absence de frontière technique externe réelle.

## 6.4 Test d’intégration

Un test est un test d’intégration lorsqu’il vérifie au moins une frontière technique réelle.

Exemples :

* application et base de données ;
* API et fournisseur d’identité ;
* lecture ou écriture de fichier ;
* publication ou consommation d’un message ;
* appel HTTP réel vers un service contrôlé ;
* génération réelle d’un document ;
* cache ;
* stockage objet ;
* migration de schéma ;
* sérialisation entre composants.

L’utilisation d’un conteneur local ou éphémère reste une intégration réelle.

Le test d’intégration doit vérifier :

* la compatibilité technique ;
* le format des échanges ;
* le comportement réel de la dépendance ;
* les cas d’erreur ;
* la gestion des délais ;
* les migrations ;
* les effets de bord.

## 6.5 Test de contrat

Un test de contrat vérifie la compatibilité entre un producteur et un consommateur.

Il peut porter sur :

* une API ;
* un schéma JSON ;
* un événement ;
* un message ;
* un fichier ;
* une commande ;
* une interface entre frontend et backend ;
* une interface entre services.

Les tests de contrat doivent vérifier lorsque pertinent :

* les champs obligatoires ;
* les types ;
* les formats ;
* les erreurs ;
* les valeurs autorisées ;
* la compatibilité ascendante ;
* la compatibilité descendante ;
* les règles de versionnement.

Un test de contrat ne remplace pas nécessairement un test d’intégration. Il protège en priorité la compatibilité de l’interface.

## 6.6 Test E2E ou système

Un test E2E vérifie un parcours à travers le système assemblé.

Il peut mobiliser :

* l’interface utilisateur ;
* l’API ;
* la logique métier ;
* la persistance ;
* l’authentification ;
* les services internes ;
* la génération d’un résultat ;
* les composants d’infrastructure.

Les tests E2E doivent rester limités aux parcours critiques.

Ils NE DOIVENT PAS reproduire exhaustivement toutes les variantes déjà couvertes par les tests unitaires, composants ou d’intégration.

Exemples :

* connexion ;
* création d’un dossier ;
* lancement d’un traitement ;
* consultation du résultat ;
* génération d’un document ;
* reprise d’une opération ;
* vérification d’un parcours avec autorisation.

---

# 7. Finalités des tests

Un test DOIT posséder au moins une finalité.

Un test PEUT posséder plusieurs finalités.

## 7.1 Finalités normalisées

| Identifiant     | Finalité                                       |
| --------------- | ---------------------------------------------- |
| `functional`    | Comportement fonctionnel ou métier             |
| `security`      | Sécurité, droits, entrées, dépendances         |
| `performance`   | Temps de réponse, débit, consommation          |
| `load`          | Charge, pointe, endurance ou volumétrie        |
| `resilience`    | Tolérance à la panne et fonctionnement dégradé |
| `recovery`      | Reprise, restauration ou redémarrage           |
| `accessibility` | Accessibilité numérique                        |
| `compatibility` | Compatibilité navigateur, OS, API ou version   |
| `migration`     | Migration de données ou de schéma              |
| `portability`   | Portabilité entre plateformes                  |
| `observability` | Logs, métriques, traces et alertes             |
| `compliance`    | Exigence normative ou réglementaire            |
| `data-quality`  | Qualité, cohérence et intégrité des données    |

Tout ajout à cette liste DOIT être documenté.

## 7.2 Distinction entre nature et finalité

Les finalités sont transversales.

Exemples corrects :

```text
Nature : unitaire
Finalité : sécurité
Objet : règle d’autorisation
```

```text
Nature : intégration
Finalités : performance, data-quality
Objet : requête sur un volume important
```

```text
Nature : E2E
Finalités : fonctionnel, accessibilité
Objet : parcours clavier du traitement principal
```

Les pourcentages par nature principale doivent totaliser 100 %.

Les pourcentages par finalité peuvent dépasser 100 %, puisqu’un test peut posséder plusieurs finalités.

---

# 8. Profil d’exécution

Chaque test ou suite DOIT être associé à un profil d’exécution principal.

| Profil             | Description                                         |
| ------------------ | --------------------------------------------------- |
| `pr`               | Exécuté sur chaque pull request                     |
| `main`             | Exécuté après intégration sur la branche principale |
| `nightly`          | Exécuté périodiquement, généralement chaque nuit    |
| `release`          | Exécuté avant une livraison                         |
| `preproduction`    | Exécuté dans un environnement représentatif         |
| `manual-trigger`   | Déclenché explicitement                             |
| `production-smoke` | Exécuté après déploiement en production             |

Un test peut être exécuté dans plusieurs profils, mais un profil principal doit être identifié pour le reporting.

## 8.1 Caractère bloquant

Chaque suite DOIT également préciser son caractère :

* `blocking` ;
* `informational`.

Un échec informatif doit rester visible et faire l’objet d’un suivi.

Le statut informatif NE DOIT PAS être utilisé pour masquer durablement un contrôle défaillant.

---

# 9. Domaine métier et criticité

## 9.1 Domaine métier

Le domaine métier est facultatif mais recommandé pour les produits d’une taille significative.

Exemples :

* authentification ;
* simulation ;
* portefeuille ;
* facturation ;
* génération de rapport ;
* importation de données ;
* configuration ;
* administration.

Le domaine permet de produire une cartographie de la couverture et d’identifier les zones disproportionnellement peu ou excessivement testées.

## 9.2 Criticité

Les niveaux normalisés sont :

* faible ;
* modérée ;
* élevée ;
* critique.

Un test critique doit être associé à :

* un risque critique ;
* un parcours critique ;
* une obligation réglementaire ;
* une règle métier essentielle ;
* une opération irréversible ;
* une fonction de sécurité.

Un test critique NE DOIT PAS être ignoré ou placé en quarantaine sans décision explicite.

---

# 10. Organisation du dépôt

## 10.1 Structure recommandée

La structure physique du dépôt DEVRAIT rendre la stratégie visible.

```text
tests/
  unit/
  component/
  integration/
  contract/
  e2e/
```

Pour un dépôt multi-composants :

```text
backend/
  tests/
    unit/
    component/
    integration/
    contract/

frontend/
  tests/
    unit/
    component/
    integration/
    contract/
    e2e/
```

Les tests peuvent être colocalisés avec le code lorsque le framework ou les pratiques du langage le justifient.

Dans ce cas, leur classification DOIT rester détectable automatiquement par :

* marqueur ;
* tag ;
* convention de fichier ;
* configuration de projet ;
* suite dédiée.

## 10.2 Convention par défaut

Un test peut hériter de sa nature principale à partir de son répertoire.

Exemple :

```text
tests/unit/
```

implique la nature `unit`.

Toute exception DOIT être explicitement déclarée.

Les finalités transversales doivent être matérialisées par des marqueurs ou des métadonnées.

## 10.3 Marqueurs contrôlés

Les marqueurs utilisés doivent être déclarés dans la configuration du framework.

La CI DOIT échouer en cas de :

* marqueur inconnu ;
* faute de frappe ;
* nature absente ;
* combinaison interdite ;
* profil non reconnu.

---

# 11. Règles de conception des tests

## 11.1 Comportement observable

Un test DEVRAIT vérifier un comportement observable.

Il NE DEVRAIT PAS dépendre excessivement :

* des méthodes privées ;
* de la structure interne ;
* de l’ordre interne des appels ;
* d’une implémentation particulière non contractuelle.

## 11.2 Assertions pertinentes

Tout test DOIT posséder au moins une assertion utile.

Une assertion utile vérifie :

* un résultat métier ;
* un effet de bord ;
* un état ;
* une erreur ;
* un événement ;
* une interaction contractuelle ;
* une propriété attendue.

Exemple insuffisant :

```python
result = calculate(data)
assert result is not None
```

Exemple attendu :

```python
result = calculate(data)
assert result.p50 == 12
assert result.p70 == 16
assert result.p90 == 21
```

## 11.3 Cas positifs, négatifs et limites

Les tests doivent couvrir selon le risque :

* comportement nominal ;
* données invalides ;
* absence de données ;
* valeurs minimales ;
* valeurs maximales ;
* erreurs attendues ;
* droits insuffisants ;
* dépendance indisponible ;
* timeout ;
* données partiellement cohérentes ;
* doublons ;
* traitements répétés.

## 11.4 Déterminisme

Un test DOIT être déterministe.

Les éléments suivants doivent être contrôlés :

* aléatoire ;
* heure ;
* fuseau horaire ;
* ordre d’exécution ;
* réseau ;
* données externes ;
* concurrence ;
* locale ;
* environnement ;
* versions de dépendances.

Les tests probabilistes DOIVENT utiliser :

* une graine contrôlée ;
* des invariants statistiques ;
* des jeux de référence ;
* des tolérances explicites lorsque nécessaire.

## 11.5 Indépendance

Chaque test DOIT pouvoir être exécuté :

* isolément ;
* dans un ordre différent ;
* en parallèle, lorsque prévu ;
* sans dépendre d’un résultat d’un test précédent.

## 11.6 Données de test

Les données de test doivent être :

* minimales ;
* lisibles ;
* déterministes ;
* représentatives ;
* non sensibles ;
* reproductibles.

Les données personnelles réelles NE DOIVENT PAS être utilisées sans cadre spécifique.

## 11.7 Mocks et doublures

Les mocks doivent être utilisés avec mesure.

Ils sont adaptés pour :

* isoler une frontière externe ;
* provoquer une erreur difficile à reproduire ;
* contrôler un comportement non déterministe ;
* vérifier un contrat local.

Ils NE DOIVENT PAS reproduire artificiellement toute l’architecture interne du système.

Un nombre excessif de mocks peut signaler :

* un couplage important ;
* une mauvaise séparation des responsabilités ;
* une testabilité insuffisante ;
* une suite liée à l’implémentation.

---

# 12. Dénombrement des tests

## 12.1 Unité principale

L’unité principale de comptage est le cas de test logique.

Un cas logique correspond à :

* une fonction de test ;
* un scénario BDD ;
* un cas déclaré dans une suite ;
* une propriété testée ;
* une vérification indépendante possédant son propre résultat.

## 12.2 Tests paramétrés

Les tests paramétrés doivent produire deux mesures :

* nombre de cas logiques ;
* nombre d’instances exécutées.

Exemple :

```text
1 fonction paramétrée
10 jeux de données
```

doit être comptabilisé comme :

```text
1 cas logique
10 instances exécutées
```

Les rapports NE DOIVENT PAS utiliser uniquement les instances paramétrées pour donner l’impression d’un volume de tests supérieur.

## 12.3 Property-based testing

Les tests génératifs doivent distinguer :

* nombre de propriétés ;
* nombre d’exemples générés ;
* nombre d’exemples réduits ;
* graines utilisées ;
* échecs reproductibles.

## 12.4 Réexécutions

Une réexécution automatique NE DOIT PAS être comptée comme un nouveau test.

Elle doit être enregistrée comme :

* une tentative supplémentaire ;
* un signal d’instabilité ;
* une contribution au taux de flakiness.

## 12.5 Tests ignorés

Les catégories suivantes doivent être distinguées :

* réussi ;
* échoué ;
* ignoré ;
* désactivé ;
* en quarantaine ;
* non exécuté à cause d’une erreur de pipeline.

Un test ignoré NE DOIT PAS être assimilé à un test réussi.

## 12.6 Tests générés automatiquement

Les tests produits par un outil ou par intelligence artificielle doivent être soumis aux mêmes règles que les autres tests.

Leur origine PEUT être indiquée, mais elle ne modifie pas les exigences relatives :

* à la classification ;
* aux assertions ;
* à la pertinence ;
* à la stabilité ;
* à la revue humaine.

---

# 13. Répartition cible par nature principale

## 13.1 Principe général

Il n’existe pas de répartition universelle applicable à tous les produits.

Chaque projet DOIT définir une répartition cible adaptée :

* à son architecture ;
* à ses risques ;
* à sa complexité métier ;
* à son modèle de déploiement ;
* à ses dépendances externes.

Les pourcentages constituent des fourchettes de pilotage et non des quotas.

Ils ne doivent pas conduire à ajouter des tests artificiels pour respecter une cible.

## 13.2 Profil générique pour une application métier

| Nature principale | Cible indicative | Fourchette |
| ----------------- | ---------------: | ---------: |
| Unitaires         |             45 % |    40–55 % |
| Composants        |             30 % |    25–35 % |
| Intégration       |             15 % |    10–20 % |
| Contrats          |              7 % |     5–10 % |
| E2E               |              3 % |      2–5 % |
| **Total**         |        **100 %** |            |

## 13.3 Profil pour un produit de calcul et de prévision de type Monte Carlo

Un produit de type Monte Carlo se caractérise notamment par :

* des calculs statistiques ou probabilistes ;
* des invariants métier ;
* des transformations de données ;
* plusieurs implémentations possibles d’une même règle ;
* une intégration avec une ou plusieurs sources externes ;
* une interface utilisateur ;
* une API ;
* des exports ou rapports ;
* des risques de volumétrie et de performance.

La répartition cible recommandée est :

| Nature principale   |     Cible | Fourchette acceptable |
| ------------------- | --------: | --------------------: |
| Tests unitaires     |  **50 %** |               45–55 % |
| Tests de composants |  **25 %** |               20–30 % |
| Tests d’intégration |  **15 %** |               12–18 % |
| Tests de contrat    |   **6 %** |                 4–8 % |
| Tests E2E           |   **4 %** |                 3–6 % |
| **Total**           | **100 %** |                       |

### Tests unitaires — 50 %

Ils doivent couvrir notamment :

* algorithmes ;
* percentiles ;
* quantiles ;
* distributions ;
* arrondis ;
* agrégations ;
* règles de capacité ;
* règles de délai ;
* invariants ;
* valeurs extrêmes ;
* données absentes ;
* cohérence entre différentes implémentations.

### Tests de composants — 25 %

Ils doivent couvrir notamment :

* moteur de simulation ;
* services applicatifs ;
* hooks ;
* préparation des résultats ;
* génération logique des diagnostics ;
* préparation des rapports ;
* composants d’interface ;
* logique de portefeuille ;
* gestion des paramètres.

### Tests d’intégration — 15 %

Ils doivent couvrir notamment :

* API externes ;
* persistance ;
* lecture de fichiers ;
* génération réelle des rapports ;
* sérialisation ;
* configuration ;
* différences de plateforme ;
* migrations ;
* formats Cloud et Server lorsque plusieurs plateformes sont supportées.

### Tests de contrat — 6 %

Ils doivent couvrir notamment :

* compatibilité frontend/backend ;
* schémas de requêtes ;
* schémas de réponses ;
* structures des simulations ;
* structures de portefeuille ;
* erreurs API ;
* compatibilité de versions.

### Tests E2E — 4 %

Ils doivent sécuriser les parcours critiques :

* importation des données ;
* lancement d’une simulation ;
* affichage des résultats ;
* modification des hypothèses ;
* recalcul ;
* génération du rapport ;
* téléchargement ;
* restauration d’une simulation ;
* comparaison entre affichage et rapport.

Les variantes de calcul NE DOIVENT PAS être testées principalement par E2E.

---

# 14. Cibles relatives aux finalités transversales

Les pourcentages ci-dessous sont indicatifs et ne doivent pas être additionnés.

| Finalité             | Cible indicative |
| -------------------- | ---------------: |
| Fonctionnel          |          85–95 % |
| Sécurité             |           8–12 % |
| Performance          |           6–10 % |
| Résilience           |            5–8 % |
| Accessibilité        |            3–5 % |
| Compatibilité        |            5–8 % |
| Migration et reprise |            2–5 % |
| Observabilité        |            2–4 % |
| Qualité des données  |  Selon criticité |

La proportion attendue dépend du contexte.

Une application réglementée ou exposée publiquement devra augmenter la part des contrôles de sécurité, de conformité et de reprise.

Un moteur de calcul ou une plateforme de données devra renforcer :

* performance ;
* volumétrie ;
* qualité des données ;
* déterminisme ;
* reproductibilité.

---

# 15. Tests non fonctionnels

## 15.1 Principe

Les tests non fonctionnels ne constituent pas un étage distinct de la pyramide.

Ils représentent des finalités transversales pouvant être vérifiées à plusieurs niveaux.

Exemple :

```text
Nature : unitaire
Finalité : performance
Objet : complexité d’un algorithme
```

```text
Nature : intégration
Finalité : sécurité
Objet : validation d’un jeton d’identité
```

```text
Nature : E2E
Finalité : accessibilité
Objet : parcours complet au clavier
```

## 15.2 Sécurité

La stratégie de sécurité doit couvrir selon le risque :

* secrets ;
* dépendances ;
* authentification ;
* autorisation ;
* validation des entrées ;
* injection ;
* exposition des données ;
* configuration ;
* journaux ;
* chiffrement ;
* API ;
* infrastructure ;
* conteneurs ;
* chaîne de construction.

Les vulnérabilités critiques non acceptées doivent bloquer la livraison.

## 15.3 Performance et charge

Les contrôles doivent couvrir selon le produit :

* temps de réponse ;
* débit ;
* ressources ;
* taille des données ;
* charge nominale ;
* pointe ;
* endurance ;
* dégradation progressive ;
* traitements concurrents ;
* génération de documents ;
* consommation mémoire.

Les seuils doivent être explicites.

Exemple :

```text
95 % des simulations standards doivent terminer en moins de 2 secondes.
```

## 15.4 Résilience

Les contrôles doivent couvrir :

* timeout ;
* retry ;
* circuit breaker ;
* indisponibilité d’une dépendance ;
* réponse partielle ;
* données invalides ;
* perte de connexion ;
* message dupliqué ;
* redémarrage ;
* interruption de traitement ;
* fonctionnement dégradé.

## 15.5 Reprise

Les contrôles de reprise doivent couvrir selon le risque :

* sauvegarde ;
* restauration ;
* rollback ;
* roll-forward ;
* reprise après redémarrage ;
* reprise d’un traitement interrompu ;
* migration ;
* compatibilité entre versions ;
* cohérence des données après incident.

## 15.6 Accessibilité

La stratégie doit combiner :

* contrôles automatisés ;
* navigation clavier ;
* gestion du focus ;
* structure sémantique ;
* contrastes ;
* formulaires ;
* messages d’erreur ;
* tests manuels ciblés ;
* technologies d’assistance lorsque nécessaire.

## 15.7 Compatibilité et portabilité

Les environnements supportés doivent être explicites.

Les tests doivent couvrir selon le besoin :

* navigateurs ;
* tailles d’écran ;
* systèmes d’exploitation ;
* versions d’API ;
* versions de base de données ;
* formats de fichiers ;
* plateformes Cloud ou Server ;
* locales ;
* fuseaux horaires.

---

# 16. Couverture du code

## 16.1 Mesures

La couverture doit être suivie au minimum par :

* lignes ;
* branches ;
* fonctions ;
* modules ou fichiers.

## 16.2 Interprétation

La couverture indique quelles parties du code ont été exécutées.

Elle ne démontre pas :

* la qualité des assertions ;
* la couverture des risques ;
* la validité des résultats ;
* la qualité des scénarios ;
* la capacité de détection.

Un taux global élevé peut masquer une couverture insuffisante du cœur métier.

## 16.3 Règles

Le projet DOIT définir :

* un seuil global ;
* un seuil sur le nouveau code ;
* des seuils renforcés sur les modules critiques ;
* une liste d’exclusions justifiées.

Une baisse de couverture doit être :

* justifiée ;
* visible ;
* approuvée lorsqu’elle affecte un composant critique.

L’objectif prioritaire doit être l’absence de régression de couverture utile.

---

# 17. Mutation testing

Le mutation testing DEVRAIT être appliqué aux composants critiques lorsque l’outillage le permet.

Il est particulièrement recommandé pour :

* moteurs de calcul ;
* règles métier ;
* sécurité ;
* algorithmes ;
* transformations sensibles ;
* autorisations ;
* conditions complexes.

Le rapport doit distinguer :

* mutants générés ;
* mutants tués ;
* mutants survivants ;
* mutants non couverts ;
* score de mutation.

Un score de couverture élevé avec un score de mutation faible doit déclencher une revue qualitative.

Le mutation testing n’a pas besoin d’être exécuté intégralement sur chaque pull request.

Il peut être :

* ciblé sur le code modifié ;
* exécuté en nightly ;
* exécuté avant release ;
* appliqué à un sous-ensemble critique.

---

# 18. Matrice risques–contrôles

Chaque projet DOIT maintenir une matrice des principaux risques.

| Risque                          |   Impact | Probabilité | Contrôle attendu         | Nature      | Finalité    |
| ------------------------------- | -------: | ----------: | ------------------------ | ----------- | ----------- |
| Erreur de calcul critique       | Critique |     Moyenne | Invariants et références | Unitaire    | Fonctionnel |
| Incompatibilité d’API           |    Élevé |     Moyenne | Test de schéma           | Contrat     | Fonctionnel |
| Perte de données                | Critique |      Faible | Persistance et reprise   | Intégration | Recovery    |
| Accès non autorisé              | Critique |      Faible | Autorisation             | Intégration | Sécurité    |
| Dégradation volumétrique        |    Élevé |      Élevée | Test de charge           | Intégration | Performance |
| Parcours principal inutilisable | Critique |      Faible | Parcours complet         | E2E         | Fonctionnel |

Tout risque critique doit être couvert.

Le taux de couverture des risques critiques doit être égal à 100 %, sauf dérogation formelle.

---

# 19. Parcours critiques

Le responsable produit et l’équipe technique doivent identifier les parcours critiques.

Chaque parcours critique doit préciser :

* son objectif ;
* ses préconditions ;
* ses principales étapes ;
* les risques ;
* les niveaux de test qui le sécurisent ;
* les contrôles non fonctionnels associés.

Un parcours critique DEVRAIT posséder :

* des tests unitaires sur ses règles ;
* un test de composant ou d’intégration ;
* un test E2E lorsque le risque le justifie ;
* des contrôles de sécurité, performance ou accessibilité selon le contexte.

Le rapport doit indiquer :

* nombre de parcours critiques ;
* nombre couverts ;
* nombre partiellement couverts ;
* nombre non couverts.

---

# 20. Indicateurs quantitatifs obligatoires

## 20.1 Volume

La CI doit produire :

* nombre total de cas logiques ;
* nombre total d’instances exécutées ;
* nombre par nature ;
* nombre par finalité ;
* nombre par profil d’exécution ;
* nombre par domaine ;
* nombre par criticité ;
* nombre de tests ignorés ;
* nombre de tests en quarantaine.

## 20.2 Résultats

Le rapport doit inclure :

* réussis ;
* échoués ;
* ignorés ;
* désactivés ;
* réexécutés ;
* interrompus ;
* en erreur d’infrastructure.

## 20.3 Durée

Le rapport doit inclure :

* durée totale ;
* durée par nature ;
* durée par suite ;
* durée moyenne ;
* durée médiane ;
* percentile 95 ;
* tests les plus lents ;
* évolution dans le temps.

## 20.4 Stabilité

Le projet doit suivre :

* taux de flakiness ;
* taux de réexécution ;
* nombre de tests intermittents ;
* durée moyenne de correction ;
* âge des tests en quarantaine.

---

# 21. Indicateurs qualitatifs obligatoires

Le projet doit suivre :

* couverture des risques critiques ;
* couverture des parcours critiques ;
* qualité des assertions ;
* couverture des cas négatifs ;
* couverture des cas limites ;
* score de mutation ;
* défauts échappés ;
* régressions de performance ;
* vulnérabilités échappées ;
* incidents liés à une absence de test ;
* duplication entre niveaux ;
* dépendance excessive aux mocks ;
* dette de test ;
* maintenabilité de la suite.

Une appréciation qualitative peut utiliser les niveaux suivants :

* solide ;
* acceptable ;
* fragile ;
* insuffisant.

Toute appréciation doit être justifiée par des éléments mesurables ou observables.

---

# 22. Seuils minimaux

Les seuils suivants constituent une base de départ.

| Indicateur                            | Seuil |
| ------------------------------------- | ----: |
| Tests classifiés                      | 100 % |
| Tests possédant une finalité          | 100 % |
| Tests critiques rattachés à un risque | 100 % |
| Risques critiques couverts            | 100 % |
| Parcours critiques couverts           | 100 % |
| Tests critiques ignorés               |     0 |
| Tests en quarantaine sans échéance    |     0 |
| Marqueurs inconnus                    |     0 |
| Taux de flakiness global              | < 1 % |
| Taux de flakiness E2E                 | < 3 % |
| Régression de contrat critique        |     0 |
| Régression de sécurité critique       |     0 |
| Régression de performance critique    |     0 |
| Régression de couverture injustifiée  |     0 |

Les seuils doivent être adaptés à la criticité du produit.

---

# 23. Intégration dans la CI/CD

## 23.1 Contrôles préliminaires

La CI doit vérifier en priorité :

* formatage ;
* linting ;
* typage ;
* compilation ;
* conventions ;
* détection de secrets ;
* validité des configurations ;
* validité de la taxonomie ;
* absence de marqueurs inconnus.

Ces contrôles doivent échouer rapidement.

## 23.2 Pull request

La pull request doit exécuter au minimum :

* tests unitaires ;
* tests de composants ;
* tests de contrat ;
* intégrations rapides ;
* sécurité statique ;
* contrôle des dépendances ;
* accessibilité automatisée rapide ;
* couverture ;
* mutation ciblée lorsque pertinente.

La durée cible du retour bloquant devrait rester inférieure à dix minutes.

## 23.3 Branche principale

La branche principale doit exécuter :

* la totalité des contrôles de pull request ;
* intégrations complètes ;
* E2E critiques ;
* tests principaux de compatibilité ;
* tests d’accessibilité ;
* tests de génération d’artefacts ;
* contrôles de déploiement.

## 23.4 Nightly

Le profil nightly devrait exécuter :

* performance ;
* volumétrie ;
* sécurité dynamique ;
* mutation testing étendu ;
* compatibilité étendue ;
* résilience ;
* recherche de flakiness ;
* tests longs.

## 23.5 Release

Le profil release doit exécuter selon le produit :

* E2E critiques ;
* smoke tests ;
* sécurité ;
* performance ;
* charge ;
* migration ;
* reprise ;
* restauration ;
* compatibilité ;
* génération des artefacts finaux ;
* vérification des rapports et livrables.

## 23.6 Production

Après déploiement, la chaîne devrait exécuter :

* smoke tests ;
* tests synthétiques ;
* vérification des métriques ;
* contrôle des erreurs ;
* contrôle des migrations ;
* vérification des files et traitements différés ;
* validation des SLO.

---

# 24. Quality gates

Les quality gates doivent être explicites.

La CI doit bloquer au minimum en cas de :

* échec d’un test critique ;
* test non classifié ;
* marqueur inconnu ;
* test critique ignoré ;
* contrat incompatible ;
* vulnérabilité critique non acceptée ;
* régression de performance critique ;
* migration invalide ;
* couverture d’un risque critique perdue ;
* échec de génération de l’artefact ;
* échec des smoke tests.

La répartition par nature ne doit pas constituer à elle seule un gate bloquant.

Une sortie de fourchette doit déclencher :

* un avertissement ;
* une analyse ;
* une décision documentée.

---

# 25. Tests intermittents

Tout test intermittent doit être identifié.

La mise en quarantaine doit préciser :

* nom du test ;
* date ;
* cause suspectée ;
* responsable ;
* ticket ;
* criticité ;
* date limite de correction.

Un test critique ne peut être mis en quarantaine qu’avec une mesure compensatoire.

La réexécution automatique NE DOIT PAS masquer le premier échec.

Le rapport doit conserver :

* résultat initial ;
* résultat après réexécution ;
* nombre de tentatives ;
* historique d’instabilité.

Un test ne doit pas rester indéfiniment en quarantaine.

---

# 26. Gestion des tests ignorés

Tout test ignoré doit posséder :

* une justification ;
* un responsable ;
* un ticket ;
* une date d’expiration ;
* une analyse du risque.

Les tests ignorés sans justification doivent faire échouer la CI.

Les tests désactivés doivent rester visibles dans les rapports.

---

# 27. Gestion de la dette de test

La dette de test doit être suivie dans le backlog.

Elle peut comprendre :

* absence de tests sur un risque ;
* tests instables ;
* tests trop lents ;
* tests sur-mockés ;
* tests sans assertion utile ;
* duplication ;
* taxonomie incorrecte ;
* faible score de mutation ;
* dépendance excessive aux E2E ;
* données de test fragiles ;
* incompatibilité avec l’exécution parallèle.

Chaque dette doit préciser :

* impact ;
* criticité ;
* cause ;
* mesure compensatoire ;
* responsable ;
* échéance.

---

# 28. Revue de code

Toute revue de code doit vérifier selon le changement :

* les tests ajoutés ;
* les tests modifiés ;
* leur nature ;
* leurs finalités ;
* leur profil ;
* leur pertinence ;
* leurs assertions ;
* leurs cas limites ;
* leur déterminisme ;
* leur coût ;
* leur impact sur la stratégie globale.

La revue doit pouvoir répondre :

* quel comportement est protégé ;
* quel risque est couvert ;
* pourquoi ce niveau de test est approprié ;
* quelles dépendances sont réelles ;
* quelles dépendances sont simulées ;
* à quel moment le test est exécuté ;
* ce qu’un échec signifierait.

Une revue incapable de dissocier et dénombrer les tests par nature ne peut pas conclure sérieusement sur la maturité de la stratégie de test.

---

# 29. Revue périodique de la stratégie

Une revue doit être réalisée :

* au démarrage du projet ;
* après un changement architectural important ;
* avant une livraison majeure ;
* après un incident significatif ;
* au minimum trimestriellement pour un produit actif.

Elle doit examiner :

* répartition des tests ;
* risques non couverts ;
* parcours critiques ;
* finalités non fonctionnelles ;
* durée des suites ;
* tests les plus lents ;
* flakiness ;
* quarantaines ;
* mocks ;
* doublons ;
* interfaces non testées ;
* E2E excessifs ;
* défauts échappés ;
* vulnérabilités ;
* incidents ;
* performance du pipeline.

La revue doit produire :

* constats ;
* risques ;
* décisions ;
* actions ;
* responsables ;
* échéances.

---

# 30. Défauts échappés et boucle d’apprentissage

Tout défaut significatif découvert après intégration ou en production doit faire l’objet d’une analyse.

L’analyse doit répondre :

* quel test aurait dû détecter le défaut ;
* pourquoi il ne l’a pas détecté ;
* si le risque était identifié ;
* si la taxonomie était correcte ;
* si l’assertion était insuffisante ;
* si le niveau de test était inadapté ;
* si une dépendance était trop simulée ;
* si le défaut nécessitait un contrôle non fonctionnel.

La correction doit inclure lorsque pertinent :

* ajout d’un test ;
* amélioration d’une assertion ;
* ajout d’un risque ;
* évolution de la stratégie ;
* modification d’un quality gate ;
* amélioration de l’observabilité ;
* correction architecturale.

Le projet doit suivre :

* nombre de défauts échappés ;
* gravité ;
* domaine ;
* nature du contrôle manquant ;
* temps de correction ;
* récurrence.

---

# 31. Reporting obligatoire

## 31.1 Synthèse exécutive

Le rapport doit présenter au minimum :

```text
Tests collectés :
Cas logiques :
Instances exécutées :
Réussis :
Échoués :
Ignorés :
En quarantaine :
Réexécutés :
Durée totale :
Flakiness :
Couverture :
Score de mutation :
Risques critiques couverts :
Parcours critiques couverts :
```

## 31.2 Répartition par nature

| Nature      | Cas | Instances | Réussis | Échoués | Durée | Flakiness |
| ----------- | --: | --------: | ------: | ------: | ----: | --------: |
| Unitaires   |     |           |         |         |       |           |
| Composants  |     |           |         |         |       |           |
| Intégration |     |           |         |         |       |           |
| Contrats    |     |           |         |         |       |           |
| E2E         |     |           |         |         |       |           |

## 31.3 Répartition par finalité

| Finalité            | Tests associés | Risques couverts | Risques non couverts |
| ------------------- | -------------: | ---------------: | -------------------: |
| Fonctionnel         |                |                  |                      |
| Sécurité            |                |                  |                      |
| Performance         |                |                  |                      |
| Résilience          |                |                  |                      |
| Accessibilité       |                |                  |                      |
| Compatibilité       |                |                  |                      |
| Reprise             |                |                  |                      |
| Qualité des données |                |                  |                      |

## 31.4 Tendances

Le rapport doit présenter l’évolution :

* volume ;
* répartition ;
* durée ;
* couverture ;
* mutation ;
* instabilité ;
* quarantaines ;
* défauts échappés ;
* performance ;
* sécurité.

Une hausse du nombre de tests accompagnée d’une baisse de stabilité ou d’une hausse importante du temps de feedback doit être considérée comme une alerte.

---

# 32. Responsabilités

## 32.1 Équipe de développement

L’équipe est responsable :

* de la conception des tests ;
* de leur classification ;
* de leur maintenance ;
* de leurs assertions ;
* de leur déterminisme ;
* de la correction des instabilités ;
* de la couverture des risques introduits.

## 32.2 Responsable technique

Le responsable technique est garant :

* de la taxonomie ;
* de l’architecture de test ;
* des quality gates ;
* des seuils ;
* des dérogations ;
* de la performance de la CI ;
* de la cohérence du reporting.

## 32.3 Responsable produit

Le responsable produit contribue à :

* identifier les parcours critiques ;
* prioriser les risques métier ;
* préciser les conséquences d’une défaillance ;
* définir les critères d’acceptation ;
* évaluer la criticité.

## 32.4 Architecture

L’architecture contribue à :

* définir les frontières ;
* identifier les contrats ;
* détecter les risques de couplage ;
* définir les tests d’architecture ;
* arbitrer la répartition des tests.

## 32.5 Sécurité

La sécurité contribue à :

* identifier les risques ;
* définir les contrôles ;
* fixer les seuils ;
* analyser les vulnérabilités ;
* valider les dérogations.

## 32.6 Exploitation et SRE

L’exploitation contribue à :

* définir les scénarios de panne ;
* définir les tests de reprise ;
* définir les SLO ;
* analyser les incidents ;
* vérifier l’observabilité ;
* valider les conditions de déploiement.

---

# 33. Critères de conformité d’une pull request

Une pull request est conforme lorsque :

* les tests nécessaires sont présents ;
* chaque nouveau test est classifié ;
* les finalités sont déclarées ;
* le profil d’exécution est défini ;
* les tests critiques sont identifiés ;
* les assertions sont pertinentes ;
* les cas négatifs nécessaires sont couverts ;
* les tests sont déterministes ;
* les tests réussissent ;
* aucun test critique n’est ignoré ;
* la couverture ne régresse pas sans justification ;
* aucun contrat critique n’est rompu ;
* aucun risque critique n’est laissé sans contrôle ;
* les rapports sont générés.

---

# 34. Definition of Done relative aux tests

Une évolution est terminée lorsque :

* le comportement attendu est testé ;
* les règles métier sont couvertes ;
* les cas négatifs pertinents sont couverts ;
* les cas limites sont couverts ;
* les interfaces modifiées sont sécurisées ;
* les impacts non fonctionnels ont été évalués ;
* les tests sont classifiés ;
* les tests sont intégrés au bon profil CI/CD ;
* les tests sont stables ;
* les résultats sont visibles ;
* la documentation est à jour ;
* aucune dette critique n’est laissée sans décision ;
* les risques résiduels sont explicitement acceptés.

---

# 35. Démarrage d’un nouveau projet

Tout nouveau projet doit réaliser les étapes suivantes.

## Étape 1 — Identifier les risques

* règles critiques ;
* parcours critiques ;
* intégrations ;
* données sensibles ;
* volumétrie ;
* disponibilité ;
* exigences réglementaires.

## Étape 2 — Définir la taxonomie

* natures ;
* finalités ;
* profils ;
* domaines ;
* niveaux de criticité.

## Étape 3 — Définir les fourchettes cibles

La répartition doit être choisie selon la nature du produit.

## Étape 4 — Structurer le dépôt

* répertoires ;
* conventions ;
* marqueurs ;
* commandes ;
* documentation.

## Étape 5 — Configurer la CI

* collecte ;
* filtrage ;
* rapports ;
* quality gates ;
* publication des résultats.

## Étape 6 — Définir les seuils

* couverture ;
* flakiness ;
* performance ;
* sécurité ;
* risques ;
* parcours critiques.

## Étape 7 — Produire une base de référence

Le projet doit conserver une première photographie :

* volume ;
* répartition ;
* durée ;
* couverture ;
* risques ;
* parcours ;
* lacunes.

---

# 36. Adaptation d’un projet existant

Pour un projet sans taxonomie existante :

1. inventorier les suites ;
2. collecter automatiquement les tests ;
3. analyser les ressources réellement utilisées ;
4. classifier par nature ;
5. identifier les finalités ;
6. détecter les tests ambigus ;
7. identifier les doublons ;
8. mesurer la durée ;
9. mesurer la stabilité ;
10. cartographier les risques ;
11. définir la cible ;
12. planifier la migration.

La régularisation peut être progressive.

Les nouveaux tests doivent respecter immédiatement le standard.

Les tests existants doivent être classifiés selon un plan priorisé :

* tests critiques ;
* E2E ;
* intégrations ;
* composants ;
* unitaires.

---

# 37. Signaux de faiblesse

Les situations suivantes doivent déclencher une analyse :

* impossibilité de dénombrer les tests par nature ;
* tests appartenant à plusieurs natures principales ;
* trop grand nombre de tests non classifiés ;
* couverture élevée avec peu d’intégrations ;
* tests E2E utilisés pour tester les variantes métier ;
* mocks omniprésents ;
* absence de contrats ;
* absence de tests non fonctionnels ;
* taux de flakiness élevé ;
* tests ignorés durablement ;
* pipeline trop lent ;
* suite dépendante de l’ordre d’exécution ;
* tests passant localement mais pas en CI ;
* défauts de production sans test de non-régression ;
* croissance du nombre de tests sans amélioration de la qualité.

Ces signaux ne constituent pas toujours une preuve de mauvaise qualité, mais ils indiquent une faiblesse de gouvernance, de testabilité ou d’architecture.

---

# 38. Règle de décision

La répartition quantitative doit être utilisée comme un outil de diagnostic.

Elle ne doit pas être utilisée comme un objectif mécanique.

Une sortie de fourchette est acceptable lorsqu’elle est justifiée par :

* la nature du produit ;
* une architecture particulière ;
* un risque spécifique ;
* une phase temporaire ;
* un besoin réglementaire ;
* une contrainte de plateforme.

Elle devient préoccupante lorsque :

* elle n’est pas expliquée ;
* elle persiste ;
* elle masque une catégorie absente ;
* elle augmente le coût de maintenance ;
* elle diminue la capacité de détection ;
* elle révèle un manque de testabilité.

---

# 39. Critère de maturité

Une stratégie de test est considérée comme maîtrisée lorsque l’équipe est capable de répondre rapidement et avec des données vérifiables aux questions suivantes :

* combien de tests possédons-nous ;
* quelle est leur nature ;
* quels risques couvrent-ils ;
* quand sont-ils exécutés ;
* combien coûtent-ils ;
* lesquels sont instables ;
* quels parcours critiques sont protégés ;
* quelles zones restent fragiles ;
* quelle confiance apportent-ils ;
* quels défauts leur ont échappé ;
* comment la stratégie évolue.

---

# 40. Conclusion normative

Une suite de tests de haut niveau doit être :

* identifiable ;
* classifiée ;
* sélectionnable ;
* dénombrable ;
* pertinente ;
* déterministe ;
* stable ;
* rapide à son niveau ;
* rattachée aux risques ;
* intégrée à la CI/CD ;
* mesurée dans le temps ;
* améliorée à partir des défauts réels.

La quantité de tests mesure l’effort de test.

La répartition, la qualité des assertions, la couverture des risques, la stabilité et la capacité de détection mesurent le niveau réel de confiance.

Le respect du présent standard constitue une condition nécessaire à une assurance qualité de haut niveau.

Il ne remplace pas :

* la qualité du besoin ;
* la qualité de l’architecture ;
* la qualité du code ;
* la sécurité par conception ;
* l’observabilité ;
* la discipline de livraison ;
* l’apprentissage à partir de la production.
