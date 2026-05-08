# CSV da Google Sheets (sorgente)

Questa cartella ospita i CSV esportati dai Google Sheets delle conferenze.

## Struttura

```
data/csv/<anno>/<conferenza_id>/
  giocanti.csv
  classifica.csv
  partite.csv
```

Esempio:

```
data/csv/2026/adriatic-a/giocanti.csv
```

## Separatore

Google Sheets (IT) spesso esporta con separatore `;`.
Lo script di import supporta sia `,` che `;`.

