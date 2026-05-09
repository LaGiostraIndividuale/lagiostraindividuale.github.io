# CSV da Google Sheets (sorgente)

Questa cartella ospita i CSV esportati dai Google Sheets delle conferenze.
Sono la **sorgente di verità** per i dati della stagione regolare: i JSON in
`assets/data/stagione-regolare/<anno>/` vengono **rigenerati automaticamente**
dai CSV (in locale o via GitHub Actions).

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
data/csv/2026/adriatic-a/classifica.csv
data/csv/2026/adriatic-a/partite.csv
```

## Separatore

Google Sheets (IT) spesso esporta con separatore `;`.
Lo script di import supporta sia `,` che `;`.

---

## Workflow: aggiungere/modificare dati

> Regola d'oro: **modifichi solo i CSV qui dentro**. I JSON e il sito si
> rigenerano da soli (in locale con uno script, su GitHub via Actions).

### A. Aggiungere una nuova conferenza

1. **Registra la conferenza** in `assets/data/stagione-regolare/<anno>/conferenze.json`:

   ```json
   {
     "id": "nuova-conf",
     "nome": "Nuova Conferenza",
     "nome_breve": "Nuova",
     "area": "Area Mölkky",
     "logo_url": "",
     "attiva": true
   }
   ```

   - `id`: usa solo `[a-z0-9-]` (no spazi, no maiuscole).

2. **Crea la cartella CSV** `data/csv/<anno>/<conf-id>/` con i 3 file.
   Puoi partire dai template in `scripts/sheets-templates/<anno>/`:

   - `giocanti.csv` — un giocante per riga (vedi sotto la regola B)
   - `classifica.csv` — una riga per giocante con `posizione` e zeri in
     `sv`/`punti`/`partite_giocate` se nessuna partita è ancora giocata.
     `partite_totali` deve essere `N - 1` (dove `N` = numero giocanti).
   - `partite.csv` — può essere vuoto (solo intestazione): le partite verranno
     generate al passo 4.

3. **Aggiungi un prefisso ID** per le partite della conferenza in
   `scripts/sheets_sync/complete_round_robin.py` (mappa `_PREFIXES`):

   ```python
   _PREFIXES = {
       ...
       "nuova-conf": "ncf",   # 3 lettere, univoche
   }
   ```

   Le partite avranno ID `ncf-001`, `ncf-002`, ...

4. **Genera il round-robin completo** (tutte le combinazioni di giocanti) e
   rigenera i JSON:

   ```bash
   python3 scripts/sheets_sync/complete_round_robin.py <anno>
   python3 scripts/sheets_sync/import_csv_to_json.py <anno>
   python3 scripts/sheets_sync/check_csv_json_sync.py <anno>
   ```

   - Lo script di completamento aggiunge solo le partite mancanti come
     `da_giocare` (mai sovrascrive partite già giocate o programmate).
   - L'ultimo comando deve stampare `OK: CSV e JSON allineati`.

5. Commit & push. La GitHub Action _Sheets CSV → JSON_ farà comunque il check
   e, se serve, il commit di sync.

### B. Aggiungere un giocante a una conferenza esistente

1. **Aggiungi una riga in `giocanti.csv`** della conferenza:

   ```csv
   nuova-conf,nuovo-id,Nome Giocante,Squadra,,N,#5b4500,Motto qui
   ```

   - `id`: solo `[a-z0-9-]`, deve essere univoco nella conferenza.
   - `colore_avatar`: tipicamente `#5b4500`.
   - `motto` con virgola → racchiuso in `"..."` (CSV standard).

2. **Aggiungi una riga in `classifica.csv`** con `posizione = N+1` e zeri:

   ```csv
   nuova-conf,N+1,nuovo-id,0,0,0,N
   ```

   - **Importante**: aggiorna `partite_totali` a `N - 1` per **tutti** i
     giocanti (incluso il nuovo), perché ora ogni giocante deve sfidarne uno
     in più.

3. **Genera le partite mancanti** (tutte vs il nuovo giocante, come
   `da_giocare`) e rigenera i JSON:

   ```bash
   python3 scripts/sheets_sync/complete_round_robin.py <anno>
   python3 scripts/sheets_sync/import_csv_to_json.py <anno>
   python3 scripts/sheets_sync/check_csv_json_sync.py <anno>
   ```

4. Commit & push.

### C. Inserire il risultato di una partita giocata

1. Trova la riga in `partite.csv` (es. `bma-008,gerri,ruco,,,,,,,da_giocare`).
2. Compila i campi numerici e cambia lo stato in `giocata`:

   ```csv
   bellomolchi-a,bma-008,gerri,ruco,0,2,38,50,42,50,giocata
   ```

   Colonne: `set_a, set_b, punti_a_set_1, punti_b_set_1, punti_a_set_2, punti_b_set_2, stato`.

3. Aggiorna a mano `classifica.csv` (sv, punti, partite_giocate, posizione) o
   ricalcolala dai punteggi delle partite — il sistema **non** la ricalcola
   automaticamente.
4. Rigenera i JSON e verifica:

   ```bash
   python3 scripts/sheets_sync/import_csv_to_json.py <anno>
   python3 scripts/sheets_sync/check_csv_json_sync.py <anno>
   ```

---

## Script utili

| Script | Cosa fa |
|---|---|
| `scripts/sheets_sync/complete_round_robin.py <anno>` | Aggiunge in `partite.csv` tutte le partite mancanti (`da_giocare`) per coprire il round-robin completo. Idempotente. |
| `scripts/sheets_sync/import_csv_to_json.py <anno>` | Rigenera i JSON in `assets/data/stagione-regolare/<anno>/` partendo dai CSV. |
| `scripts/sheets_sync/check_csv_json_sync.py <anno>` | Verifica che CSV e JSON siano allineati. Esce con codice di errore se non lo sono (usato in CI). |
| `scripts/validate_stagione_regolare.rb <anno>` | Validazione ulteriore (schema, conteggio partite atteso, stato). |

## Automazione GitHub

Vedi `.github/workflows/`:

- `sheets-sync.yml` — al push su `data/csv/**` rigenera i JSON e li committa.
- `stagione-regolare-csv-json-check.yml` — controlla l'allineamento su PR/push.

## Regola "A" (conferenze non cliccabili)

Se una conferenza non ha **nessuna** partita con `stato=giocata`, sul sito
risulta non cliccabile. Per renderla cliccabile basta inserire almeno un
risultato in `partite.csv`.
