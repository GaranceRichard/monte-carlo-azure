# Feature 13 — Disposer d’une gouvernance technique rationalisée

Le résultat observable, le flux de valeur et le statut de la Feature sont définis dans le
[`registre du backlog`](../backlog.md). Ce document ne porte que ses attendus détaillés et preuves de
cadrage.

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


## 13.10 — Approvisionnement des images de services CI indépendant et immuable

- supprimer la dépendance directe de la CI à Docker Hub pour les images de services critiques ;
- répliquer l’image MongoDB approuvée dans GitHub Container Registry ;
- référencer l’image CI par digest immuable ;
- utiliser des permissions minimales et le `GITHUB_TOKEN` pour l’accès au package ;
- définir un processus contrôlé de mise à jour du miroir depuis l’image amont ;
- distinguer explicitement les échecs de récupération d’image, de démarrage du service et de tests backend ;
- ne modifier ni le comportement MongoDB attendu, ni les tests produit, ni les seuils de qualité.

## Preuves de cadrage sans effet sur le statut

La colonne `Réalisé le` du [`registre du backlog`](../backlog.md) reste la seule autorité de statut. Au
27/07/2026, les preuves de cadrage disponibles étaient :

- `.github/workflows/ci.yml` référence encore directement `mongo:7` pour le service MongoDB ;
- le commit `e1d64b6948105359533fec4ef915a4d9c25f0a60` du 26/07/2026 ajoute le PBI au backlog ;
- le commit `73258201936afa435d0ba62d86371689218b4f15` du 26/07/2026 ajoute uniquement les attendus ci-dessus.

Ces preuves documentent le besoin mais ne démontrent ni miroir GHCR, ni référence par digest immuable, ni
processus de mise à jour livré.
