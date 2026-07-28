# Rapport de parité statistique

- Contrôle : informatif, non bloquant
- Statut : `divergence`
- Corpus : `mca-statistical-reference-corpus` `1.0` / `mca-prng-v1`
- Cas : 15

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
| `histogram-aggregated-contiguous-101` | `normative_divergence` (149) | `normative_divergence` (51) | `engine_divergence` (149) |
| `histogram-aggregated-discontinuous` | `normative_divergence` (1) | `normative_divergence` (2) | `engine_divergence` (2) |

Les nombres entre parenthèses comptent les différences exactes. Le rapport JSON conserve chaque chemin et chaque valeur, sans tolérance numérique, réordonnancement d’histogramme ni valeur absente reconstruite.
