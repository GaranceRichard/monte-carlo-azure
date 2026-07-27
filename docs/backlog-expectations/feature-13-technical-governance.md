# Feature 13 — Rationaliser le dispositif de gouvernance technique

**Description :** mesurer la valeur, le coût et les recouvrements des contrôles du dépôt, puis simplifier le dispositif sans affaiblir les protections critiques.

**Flux de valeur :** conserver une forte confiance dans le produit tout en réduisant le temps de changement, la charge de maintenance et la complexité de reprise par un autre contributeur.

**Backlog :** [`../backlog.md`](../backlog.md)

## Principe de rationalisation

La Feature ne poursuit aucun objectif arbitraire de réduction du nombre de lignes ou de scripts.

Chaque contrôle doit être évalué selon :

- le risque protégé ;
- les défauts effectivement détectés ;
- le coût d’exécution ;
- le coût de maintenance ;
- les recouvrements avec d’autres contrôles ;
- la capacité d’un nouveau mainteneur à le comprendre et le réparer.

Les contrôles de sécurité, de contrat, de parité statistique et de protection des parcours critiques restent prioritaires.
