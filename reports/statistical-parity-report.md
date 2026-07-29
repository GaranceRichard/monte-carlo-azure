# Rapport de parité statistique

- Contrôle : informatif, non bloquant
- Statut : `match`
- Corpus : `mca-statistical-reference-corpus` `1.0` / `mca-prng-v1`
- Cas : 16
- Validation PBI 2.13 : `match` (22/22 probes concordantes)

| Cas | Python / norme | TypeScript / norme | Python / TypeScript |
| --- | --- | --- | --- |
| `items-zero-weeks-excluded` | `match` (0) | `match` (0) | `match` (0) |
| `weeks-zero-weeks-included-no-censorship` | `match` (0) | `match` (0) | `match` (0) |
| `weeks-exact-horizon-completion` | `match` (0) | `match` (0) | `match` (0) |
| `weeks-partial-censorship` | `match` (0) | `match` (0) | `match` (0) |
| `weeks-total-censorship` | `match` (0) | `match` (0) | `match` (0) |
| `risk-p50-zero-absent` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-slope-005-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-slope-010-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-slope-minus-015-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-cv-050-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-cv-100-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-cv-150-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-iqr-050-rounded` | `match` (0) | `match` (0) | `match` (0) |
| `reliability-seven-observations-degraded` | `match` (0) | `match` (0) | `match` (0) |
| `histogram-aggregated-contiguous-101` | `match` (0) | `match` (0) | `match` (0) |
| `histogram-aggregated-discontinuous` | `match` (0) | `match` (0) | `match` (0) |

Les nombres entre parenthèses comptent les différences exactes. Le rapport JSON conserve chaque chemin et chaque valeur, sans tolérance numérique, réordonnancement d’histogramme ni valeur absente reconstruite.

## Alignement de validation PBI 2.13

| Probe | Attendu | Python | TypeScript | Statut |
| --- | --- | --- | --- | --- |
| `backlog-inclusive-minima` | `True` | `True` | `True` | `match` |
| `backlog-inclusive-maxima` | `True` | `True` | `True` | `match` |
| `items-zero-weeks-included` | `True` | `True` | `True` | `match` |
| `items-six-usable-after-zero-filter` | `True` | `True` | `True` | `match` |
| `sample-string-rejected` | `False` | `False` | `False` | `match` |
| `sample-decimal-rejected` | `False` | `False` | `False` | `match` |
| `sample-negative-rejected` | `False` | `False` | `False` | `match` |
| `sample-boolean-rejected` | `False` | `False` | `False` | `match` |
| `raw-history-short-rejected` | `False` | `False` | `False` | `match` |
| `usable-history-short-rejected` | `False` | `False` | `False` | `match` |
| `zero-policy-string-rejected` | `False` | `False` | `False` | `match` |
| `zero-policy-default-forbidden` | `False` | `False` | `False` | `match` |
| `simulation-count-default-forbidden` | `False` | `False` | `False` | `match` |
| `simulation-count-lower-bound-rejected` | `False` | `False` | `False` | `match` |
| `active-parameter-missing` | `False` | `False` | `False` | `match` |
| `inactive-parameter-present` | `False` | `False` | `False` | `match` |
| `unknown-field-rejected` | `False` | `False` | `False` | `match` |
| `seed-string-rejected` | `False` | `False` | `False` | `match` |
| `seed-decimal-rejected` | `False` | `False` | `False` | `match` |
| `seed-negative-rejected` | `False` | `False` | `False` | `match` |
| `seed-overflow-rejected` | `False` | `False` | `False` | `match` |
| `target-decimal-rejected` | `False` | `False` | `False` | `match` |

Ces probes couvrent la forme fermée, les valeurs par défaut résolues, le paramètre de mode exclusif, les entiers stricts, les zéros, les bornes et la seed uint32. Ils ne modifient aucune formule statistique ; le corpus prouve les PBI 2.14 à 2.16 ; rapport informatif jusqu’au PBI 2.19.
