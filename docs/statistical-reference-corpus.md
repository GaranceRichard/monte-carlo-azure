# Contrat du corpus de référence statistique

Le PBI 2.9 établit le format sérialisé commun utilisé par les futurs cas des PBI 2.10 et 2.11. Il ne
constitue pas encore ces jeux de référence et ne les exécute dans aucun moteur.

## Autorité et fichiers

Le contrat normatif initial est la version `1.0`, exprimée en JSON Schema draft 2020-12 :

- [`contracts/statistical-reference-corpus-v1.0.schema.json`](../contracts/statistical-reference-corpus-v1.0.schema.json)
  est l’autorité machine, indépendante de Python et TypeScript ;
- [`contracts/examples/statistical-reference-corpus-v1.0.minimal.json`](../contracts/examples/statistical-reference-corpus-v1.0.minimal.json)
  prouve la structure avec un seul cas trivial ;
- [`contracts/examples/statistical-reference-corpus-v1.0.invalid.json`](../contracts/examples/statistical-reference-corpus-v1.0.invalid.json)
  est un contre-exemple minimal et volontairement invalide ;
- [`contracts/mca-prng-v1-vectors.json`](../contracts/mca-prng-v1-vectors.json) reste l’autorité distincte
  sur les sorties du PRNG et les indices d’échantillonnage.

Un document porte obligatoirement `schema_version = "1.0"`, l’identité stable du corpus, la référence à
`STD-STAT-001` version `1.0`, le contrat `mca-prng-v1` et une liste de cas. Les objets sont fermés par
`additionalProperties: false` à chaque niveau.

## Forme d’un cas

Chaque cas associe sans ambiguïté :

- un identifiant stable, unique dans la version du corpus, et une description lisible ;
- un `proof_level` choisi dans les quatre niveaux de `STAT-PAR-001` : `algorithmic`, `deterministic`,
  `replay` ou `distributional` ;
- une `input` normalisée, sans défaut de transport ni paramètre inactif ;
- une `seed` uint32 résolue dans `0..4294967295`, consommée par `mca-prng-v1` ;
- un `expected_result` exprimé dans la forme normative commune, avant présentation, persistance ou
  diagnostic métier.

Les entrées imposent de 6 à 521 observations entières positives ou nulles, au moins six observations
strictement positives lorsque `include_zero_weeks` vaut `false`, et `n_sims` dans `1000..200000`.
`backlog_to_weeks` exige uniquement `backlog_size` dans `1..1000000`; `weeks_to_items` exige uniquement
`target_weeks` dans `1..521`.

Les résultats n’acceptent que `P50`, `P70` et `P90`, au plus 100 buckets non vides, les quatre labels de
fiabilité normatifs, une seed uint32 et des comptes bornés par les domaines existants. Le mode backlog
impose `result_kind = "weeks"` et `completion_summary`; le mode capacité impose `result_kind = "items"` et
interdit ce résumé.

## Invariants normatifs

JSON Schema 2020-12 exprime directement les types, bornes, champs obligatoires, propriétés fermées,
cardinalités, paramètres actifs et discriminants de mode. Les relations entre valeurs sont aussi consignées
dans le `$comment` normatif de `expectedResult` et restent gouvernées par `STD-STAT-001` :

- la seed du résultat est identique à la seed du cas ;
- `samples_count` est identique dans le résultat et la fiabilité ;
- les percentiles présents sont croissants en mode backlog et décroissants en mode capacité ;
- les abscisses d’histogramme sont strictement croissantes et les comptes conservent la masse attendue ;
- les comptes de complétion totalisent `n_sims`, et le taux de censure applique l’arrondi `round half up`
  à quatre décimales ;
- `risk_score` est omis lorsqu’il n’est pas calculable et suit sinon la formule du mode.

Ces relations arithmétiques ne sont pas remplacées par une extension propriétaire comme `$data` : le
contrat reste lisible par tout validateur standard draft 2020-12. Leur exécution dans Python et TypeScript
reste explicitement hors du PBI 2.9 et appartient aux runners du PBI 2.12.

## Contrôle autonome

Le contrôle ne charge ni moteur, ni DTO, ni API :

```bash
.venv\Scripts\python.exe Scripts/validate_statistical_reference_corpus.py
```

Il valide le métaschème, accepte l’exemple positif, exige le rejet du contre-exemple et vérifie que ce rejet
désigne `/cases/0/input` avec le mot-clé `additionalProperties`. Des corpus candidats peuvent être fournis
en arguments. Chaque erreur contient le fichier, un JSON Pointer d’instance, le mot-clé en défaut, un message
et le JSON Pointer du schéma, par exemple :

```text
candidate.json:/cases/0/seed: [maximum] 4294967296 is greater than the maximum of 4294967295
```

Le chargeur refuse aussi les propriétés JSON dupliquées avant la validation, car un parseur JSON ordinaire
les écraserait avant que JSON Schema puisse les observer.

## Évolution

La version `1.0` est immuable. Toute évolution incompatible des entrées, de la seed, des résultats ou du
niveau de preuve requiert une nouvelle version normative et une décision de compatibilité conforme à
`STAT-PAR-048`. Ce versionnement du corpus ne modifie aucun DTO, payload API, document MongoDB ni objet
`localStorage`.
