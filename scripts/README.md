# Scripts

## Validazione dati Stagione Regolare

Questo repo usa JSON statici in `assets/data/stagione-regolare/<anno>/...`.

Lo script `scripts/validate_stagione_regolare.rb` controlla:

- `conferenze.json` (schema base, id validi, duplicati)
- presenza cartelle e file per conferenza attiva
- coerenza tra `giocanti.json`, `classifica.json`, `partite.json`
- valori `stato` ammessi
- conteggio partite atteso \(formula \(n \cdot (n-1) / 2\)\) come warning

### Esecuzione (consigliata via Docker)

```bash
docker compose run --rm jekyll bash -lc "ruby scripts/validate_stagione_regolare.rb 2026"
```

Se vuoi validare un anno diverso:

```bash
docker compose run --rm jekyll bash -lc "ruby scripts/validate_stagione_regolare.rb 2027"
```

