# Monte Carlo Azure — Prévision de livraison pour équipes agiles

> *Combien de semaines pour finir ce backlog ? Combien d'items livrés d'ici la fin du trimestre ?*
> Monte Carlo Azure répond à ces questions en quelques secondes, à partir de l'historique réel de votre équipe.

---

## Le problème que ça résout

Les estimations de livraison en agile reposent souvent sur l'intuition ou des points de complexité difficiles à comparer. La simulation Monte Carlo est une approche éprouvée : elle utilise le **rythme de livraison passé de l'équipe** pour projeter des probabilités de livraison future, sans formule magique ni points de story.

Monte Carlo Azure automatise cette approche en se connectant directement à Azure DevOps — zéro saisie manuelle, zéro tableur à maintenir.

---

## Ce que fait l'outil

**Deux questions, deux modes :**

- **Backlog → Semaines** — *"Combien de semaines pour finir mes 80 items ?"*
  L'outil répond : "50% de chances d'ici 10 semaines, 90% de chances d'ici 14 semaines."

- **Semaines → Items** — *"Combien d'items livrés d'ici 12 semaines ?"*
  L'outil répond : "70% de chances de livrer au moins 35 items."

**Ce que vous obtenez :**

- Des **probabilités claires** (P50, P70, P90) — pas une date unique qui sera forcément fausse
- Des **graphiques exportables** en PDF, prêts pour une présentation ou un comité de pilotage
- Un **historique local** des 10 dernières simulations pour comparer les scénarios
- Un paramètre de **capacité réduite** — si l'équipe est à 70% pendant 4 semaines (congés, autre projet), l'impact est calculé automatiquement

---

## Comment ça marche

1. **Connexion** avec votre PAT Azure DevOps (token personnel, jamais transmis à un serveur)
2. **Sélection** de votre organisation → projet → équipe
3. **Configuration** de la période d'historique et du type de tickets à analyser
4. **Lancement** — la simulation tourne en quelques secondes
5. **Export** du rapport en PDF ou du throughput en CSV

---

## Ce que l'outil ne fait pas

- Il ne se connecte pas à Jira (Azure DevOps uniquement pour l'instant)
- Il ne stocke aucune donnée — tout reste dans votre navigateur
- Il ne remplace pas le jugement d'équipe — il l'éclaire avec des données

---

## Confidentialité

Votre token Azure DevOps (PAT) ne quitte jamais votre navigateur. Le serveur ne reçoit que des nombres anonymes (le rythme de livraison hebdomadaire de l'équipe) pour calculer la simulation — aucune donnée d'identification, aucun nom de projet, aucun contenu de ticket.

---

## Pour qui

- **Scrum Masters et coaches agiles** qui veulent des prévisions fondées sur des données réelles
- **Chefs de projet** qui doivent répondre à "c'est livré pour quand ?"
- **Product Owners** qui arbitrent entre scope et délai avec des éléments chiffrés
- **Équipes de développement** qui veulent visualiser leur propre cadence

---

## Accès

L'outil est accessible via navigateur, sans installation. Un accès Azure DevOps et un PAT valide suffisent.