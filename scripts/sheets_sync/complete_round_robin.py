#!/usr/bin/env python3
"""
Completa il round-robin in `data/csv/<anno>/<conferenza_id>/partite.csv`.

Per ogni conferenza, ogni giocante deve sfidare ogni altro giocante esattamente
una volta. Le partite mancanti vengono aggiunte in coda al CSV come
`da_giocare`, preservando le partite esistenti (sia quelle giocate sia quelle
già programmate).

Convenzioni:
- Ordine canonico delle nuove partite: prima per indice del giocante A in
  `giocanti.csv`, poi per indice del giocante B (con A < B).
- ID partite: prefisso per conferenza (vedi `_PREFIXES`) + numero progressivo
  a tre cifre, continuando dalla numerazione massima esistente.

Esempio:
    python3 scripts/sheets_sync/complete_round_robin.py 2026
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

_PREFIXES: Dict[str, str] = {
    "adriatic-a": "ada",
    "adriatic-b": "adb",
    "bellomolchi-a": "bma",
    "bellomolchi-b": "bmb",
    "jattalavoro": "jat",
    "emiliana": "emi",
    "flus": "flu",
    "molkky-e-fuggi": "mef",
    "satania": "sat",
    "tiferno": "tif",
    "balera": "bal",
}

_PARTITE_HEADER = [
    "conferenza_id",
    "id",
    "giocante_a_id",
    "giocante_b_id",
    "set_a",
    "set_b",
    "punti_a_set_1",
    "punti_b_set_1",
    "punti_a_set_2",
    "punti_b_set_2",
    "stato",
]

_ID_NUM_RE = re.compile(r"-(\d+)$")


def _read_csv(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def _write_csv(path: Path, header: List[str], rows: List[Dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=header)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in header})


def _pair_key(a: str, b: str) -> Tuple[str, str]:
    return tuple(sorted([a, b]))


def _next_num(rows: List[Dict[str, str]]) -> int:
    max_num = 0
    for r in rows:
        match = _ID_NUM_RE.search(r.get("id", "") or "")
        if match:
            n = int(match.group(1))
            if n > max_num:
                max_num = n
    return max_num


def _complete_conference(conf_dir: Path, conf_id: str) -> Tuple[int, int, int]:
    """Ritorna (giocanti, totali, aggiunte)."""
    giocanti_csv = conf_dir / "giocanti.csv"
    partite_csv = conf_dir / "partite.csv"

    if not giocanti_csv.is_file():
        print(f"  - skip {conf_id}: manca giocanti.csv")
        return (0, 0, 0)

    giocanti_rows = [r for r in _read_csv(giocanti_csv) if (r.get("id") or "").strip()]
    player_ids = [r["id"].strip() for r in giocanti_rows]

    if not player_ids:
        return (0, 0, 0)

    if conf_id not in _PREFIXES:
        print(f"  - skip {conf_id}: prefisso ID non definito")
        return (len(player_ids), 0, 0)

    prefix = _PREFIXES[conf_id]

    existing: List[Dict[str, str]] = []
    if partite_csv.is_file():
        existing = [r for r in _read_csv(partite_csv) if (r.get("id") or "").strip()]

    existing_pairs = set()
    for r in existing:
        a = (r.get("giocante_a_id") or "").strip()
        b = (r.get("giocante_b_id") or "").strip()
        if a and b:
            existing_pairs.add(_pair_key(a, b))

    next_num = _next_num(existing)
    added = 0
    new_rows: List[Dict[str, str]] = []
    for i, pa in enumerate(player_ids):
        for pb in player_ids[i + 1 :]:
            if _pair_key(pa, pb) in existing_pairs:
                continue
            next_num += 1
            new_rows.append(
                {
                    "conferenza_id": conf_id,
                    "id": f"{prefix}-{next_num:03d}",
                    "giocante_a_id": pa,
                    "giocante_b_id": pb,
                    "set_a": "",
                    "set_b": "",
                    "punti_a_set_1": "",
                    "punti_b_set_1": "",
                    "punti_a_set_2": "",
                    "punti_b_set_2": "",
                    "stato": "da_giocare",
                }
            )
            existing_pairs.add(_pair_key(pa, pb))
            added += 1

    if added or not partite_csv.is_file():
        normalized_existing = [
            {**{"conferenza_id": conf_id}, **{k: (r.get(k) or "") for k in _PARTITE_HEADER if k != "conferenza_id"}}
            for r in existing
        ]
        all_rows = normalized_existing + new_rows
        _write_csv(partite_csv, _PARTITE_HEADER, all_rows)

    n = len(player_ids)
    expected = n * (n - 1) // 2
    total = len(existing) + added
    flag = "OK" if total == expected else "WARN"
    print(f"  [{flag}] {conf_id}: {n} giocanti, {total}/{expected} partite (+{added})")
    return (n, total, added)


def main(argv: List[str]) -> int:
    year = argv[1] if len(argv) > 1 else "2026"
    repo_root = Path(__file__).resolve().parents[2]
    csv_year = repo_root / "data" / "csv" / year
    if not csv_year.is_dir():
        print(f"ERRORE: cartella non trovata: {csv_year}", file=sys.stderr)
        return 2

    print(f"Completamento round-robin in {csv_year}:")
    total_added = 0
    for conf_dir in sorted(csv_year.iterdir()):
        if not conf_dir.is_dir():
            continue
        _, _, added = _complete_conference(conf_dir, conf_dir.name)
        total_added += added

    print(f"\nTotale partite aggiunte: {total_added}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
