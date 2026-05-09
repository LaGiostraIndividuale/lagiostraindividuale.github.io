#!/usr/bin/env python3
"""
Verifica che i JSON in assets/data/stagione-regolare/<anno>/<conferenza>/
siano identici al risultato della conversione dai CSV in data/csv/<anno>/.

Utile in CI per intercettare commit solo su CSV, solo su JSON errati, o merge parziali.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def _load_import_module():
    path = Path(__file__).resolve().parent / "import_csv_to_json.py"
    name = "sheets_csv_import"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Impossibile caricare {path}")
    mod = importlib.util.module_from_spec(spec)
    # Necessario per @dataclass nel modulo caricato dinamicamente (Python 3.9).
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _norm_partite(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    keys = [
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

    def cell(v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        if isinstance(v, float) and v == int(v):
            return int(v)
        return v

    out: List[Dict[str, Any]] = []
    for raw in items:
        row = {k: cell(raw.get(k)) for k in keys}
        out.append(row)
    return sorted(out, key=lambda r: r["id"])


def _norm_classifica(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    keys = ["posizione", "giocante_id", "sv", "punti", "partite_giocate", "partite_totali"]

    def cell(v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, float) and v == int(v):
            return int(v)
        return v

    out: List[Dict[str, Any]] = []
    for raw in items:
        row = {k: cell(raw.get(k)) for k in keys}
        out.append(row)
    return sorted(out, key=lambda r: (r["posizione"], r["giocante_id"]))


def _norm_giocanti(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    keys = ["id", "nome", "conferenza", "squadra", "foto_url", "iniziale", "colore_avatar", "motto"]
    out: List[Dict[str, Any]] = []
    for raw in items:
        row: Dict[str, Any] = {}
        for k in keys:
            v = raw.get(k, "")
            row[k] = (v or "").strip() if isinstance(v, str) else v
        out.append(row)
    return sorted(out, key=lambda r: r["id"])


def main(argv: List[str]) -> int:
    year = argv[1] if len(argv) > 1 else "2026"
    mod = _load_import_module()
    repo_root = Path(__file__).resolve().parents[2]
    csv_year = repo_root / "data" / "csv" / year
    json_year = repo_root / "assets" / "data" / "stagione-regolare" / year

    if not csv_year.is_dir():
        print(f"OK: nessuna cartella {csv_year}, skip.")
        return 0

    conferenze_path = json_year / "conferenze.json"
    if not conferenze_path.is_file():
        print(f"ERRORE: manca {conferenze_path}", file=sys.stderr)
        return 2

    conferenze = json.loads(conferenze_path.read_text(encoding="utf-8"))
    allowed = {c["id"] for c in conferenze}
    id_to_nome = {c["id"]: c["nome"] for c in conferenze}

    errors: List[str] = []
    for conf_dir in sorted(csv_year.iterdir()):
        if not conf_dir.is_dir():
            continue
        conf_id = conf_dir.name
        if conf_id not in allowed:
            continue

        jdir = json_year / conf_id
        nome = id_to_nome[conf_id]

        partite_csv = conf_dir / "partite.csv"
        partite_json = jdir / "partite.json"
        if partite_csv.is_file():
            if not partite_json.is_file():
                errors.append(f"{conf_id}: c'è partite.csv ma manca partite.json")
            else:
                rows = mod._normalize_rows(mod._read_csv_rows(partite_csv))
                expected = mod._convert_partite(rows)
                actual = json.loads(partite_json.read_text(encoding="utf-8"))
                if _norm_partite(expected) != _norm_partite(actual):
                    errors.append(
                        f"{conf_id}: partite.json ≠ partite.csv "
                        f"(rigenera: python3 scripts/sheets_sync/import_csv_to_json.py {year})"
                    )

        classifica_csv = conf_dir / "classifica.csv"
        classifica_json = jdir / "classifica.json"
        if classifica_csv.is_file():
            if not classifica_json.is_file():
                errors.append(f"{conf_id}: c'è classifica.csv ma manca classifica.json")
            else:
                rows = mod._normalize_rows(mod._read_csv_rows(classifica_csv))
                expected = mod._convert_classifica(rows)
                actual = json.loads(classifica_json.read_text(encoding="utf-8"))
                if _norm_classifica(expected) != _norm_classifica(actual):
                    errors.append(
                        f"{conf_id}: classifica.json ≠ classifica.csv "
                        f"(rigenera: python3 scripts/sheets_sync/import_csv_to_json.py {year})"
                    )

        giocanti_csv = conf_dir / "giocanti.csv"
        giocanti_json = jdir / "giocanti.json"
        if giocanti_csv.is_file():
            if not giocanti_json.is_file():
                errors.append(f"{conf_id}: c'è giocanti.csv ma manca giocanti.json")
            else:
                rows = mod._normalize_rows(mod._read_csv_rows(giocanti_csv))
                expected = mod._convert_giocanti(rows, nome)
                actual = json.loads(giocanti_json.read_text(encoding="utf-8"))
                if _norm_giocanti(expected) != _norm_giocanti(actual):
                    errors.append(
                        f"{conf_id}: giocanti.json ≠ giocanti.csv "
                        f"(rigenera: python3 scripts/sheets_sync/import_csv_to_json.py {year})"
                    )

    if errors:
        print("ERRORE: CSV (Sheets) e JSON (sito) non coincidono:", file=sys.stderr)
        for e in errors:
            print(f"  • {e}", file=sys.stderr)
        return 1

    print(f"OK: CSV e JSON allineati per data/csv/{year}/ (conferenze in conferenze.json).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
