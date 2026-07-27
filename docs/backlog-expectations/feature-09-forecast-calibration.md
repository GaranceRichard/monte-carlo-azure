# Feature 9 — Éprouver les prévisions face au temps et aux résultats réels

**Description :** comparer les projections aux résultats observés et détecter les changements de comportement qui rendent un historique moins représentatif.

**Flux de valeur :** distinguer une prévision techniquement calculable d’une méthode empiriquement crédible pour soutenir une décision.

**Backlog :** [`../backlog.md`](../backlog.md)

## Décision attendue sur le Risk Score

- tester sa relation avec les écarts réellement observés ;
- mesurer sa stabilité selon le mode, `n_sims` et la fenêtre historique ;
- vérifier sa valeur supplémentaire par rapport à P50, P90 et aux diagnostics ;
- calibrer les seuils de lecture ;
- le renommer en « Indice de dispersion » si aucune interprétation empirique du risque n’est démontrée ;
- le retirer s’il n’améliore pas la décision.
