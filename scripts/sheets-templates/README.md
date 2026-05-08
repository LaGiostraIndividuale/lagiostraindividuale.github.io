# Template Google Sheets (Stagione Regolare)

Importa questi CSV in Google Sheets per avere le intestazioni “ufficiali” allineate ai JSON del sito.

## Dove sono i file

- `scripts/sheets-templates/2026/conferenze.csv`
- `scripts/sheets-templates/2026/giocanti.csv`
- `scripts/sheets-templates/2026/classifica.csv`
- `scripts/sheets-templates/2026/partite.csv`

## Procedura di import in Google Sheets

1. Crea un nuovo Google Sheet (vuoto).
2. Rinomina i tab: `conferenze`, `giocanti`, `classifica`, `partite`.
3. Per ogni tab:
   - **File → Importa → Carica**
   - scegli il CSV corrispondente
   - **Sostituisci i dati nel foglio corrente**

## Regola “A” (conferenze non cliccabili)

Se una conferenza non ha ancora partite giocate:

- in `partite` **non aggiungere righe** per quella conferenza (lascia vuoto)

La conferenza resterà non cliccabile finché non inserirai almeno una riga con `stato=giocata`.

