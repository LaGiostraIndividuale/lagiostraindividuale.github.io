# Sheets sync (CSV -> JSON)

## Obiettivo

Usare i CSV esportati dai Google Sheets (uno sheet per conferenza) come sorgente dati,
e rigenerare automaticamente i JSON consumati dal sito.

## Dove mettere i CSV

```
data/csv/<anno>/<conferenza_id>/
  giocanti.csv
  classifica.csv
  partite.csv
```

## Comando locale

```bash
python3 scripts/sheets_sync/import_csv_to_json.py 2026
```

## Automazione (GitHub Actions)

Workflow: `.github/workflows/sheets-sync.yml`

- parte automaticamente quando cambi qualcosa in `data/csv/**`
- oppure manualmente da GitHub → Actions → "Sheets CSV -> JSON"

