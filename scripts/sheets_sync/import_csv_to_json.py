#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


RE_INT = re.compile(r"^-?\d+$")


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _sniff_delimiter(sample: str) -> str:
    # Prefer ';' for Italian locale exports, fallback to ','.
    semi = sample.count(";")
    comma = sample.count(",")
    if semi == comma == 0:
        return ","
    return ";" if semi >= comma else ","


def _read_csv_rows(path: Path) -> List[Dict[str, str]]:
    raw = _read_text(path)
    delim = _sniff_delimiter(raw[:4096])
    # Normalize newlines; csv module handles \r\n too, but keep simple.
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=delim)
        return [{k: (v or "") for k, v in row.items()} for row in reader]


def _parse_int_strict(s: str, field: str) -> int:
    """Intero da cella Fogli (IT): accetta '8', '8,0', '8.0', spazi."""
    raw = (s or "").strip().replace(" ", "")
    if raw == "":
        raise ValueError(f"Campo obbligatorio vuoto: {field}")
    # Decimali export IT/US: prendi la parte intera prima di , o .
    if "," in raw:
        raw = raw.split(",")[0]
    elif "." in raw:
        raw = raw.split(".")[0]
    if not RE_INT.match(raw):
        raise ValueError(f"{field}: valore non intero: {s!r}")
    return int(raw)


def _to_int_or_none(s: str) -> Optional[int]:
    s = (s or "").strip()
    if s == "":
        return None
    if "," in s and "." not in s:
        s = s.split(",")[0]
    elif "." in s:
        s = s.split(".")[0]
    if not RE_INT.match(s):
        raise ValueError(f"Valore non intero: {s!r}")
    return int(s)


def _required(row: Dict[str, str], key: str) -> str:
    v = (row.get(key) or "").strip()
    if v == "":
        raise ValueError(f"Campo obbligatorio mancante: {key}")
    return v


def _strip_key(row: Dict[str, str]) -> Dict[str, str]:
    """Normalizza chiavi CSV (es. BOM su prima colonna) e valori."""
    out: Dict[str, str] = {}
    for k, v in row.items():
        if k is None:
            continue
        nk = k.lstrip("\ufeff").strip()
        out[nk] = v if v is None else str(v).strip()
    return out


def _normalize_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return [_strip_key(r) for r in rows]


@dataclass(frozen=True)
class Conference:
    id: str
    nome: str


def _load_conferences(conferenze_json_path: Path) -> Dict[str, Conference]:
    data = json.loads(_read_text(conferenze_json_path))
    out: Dict[str, Conference] = {}
    for c in data:
        cid = c["id"]
        out[cid] = Conference(id=cid, nome=c["nome"])
    return out


def _convert_giocanti(rows: List[Dict[str, str]], conference_name: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        if not (r.get("id") or "").strip():
            continue
        out.append(
            {
                "id": _required(r, "id"),
                "nome": _required(r, "nome"),
                "conferenza": conference_name,
                "squadra": (r.get("squadra") or "").strip(),
                "foto_url": (r.get("foto_url") or "").strip(),
                "iniziale": (r.get("iniziale") or "").strip(),
                "colore_avatar": (r.get("colore_avatar") or "").strip(),
                "motto": (r.get("motto") or "").strip(),
            }
        )
    return out


def _convert_classifica(rows: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        # Fogli esporta spesso righe vuote in coda (ARRAYFORMULA / righe extra).
        if not (r.get("giocante_id") or "").strip():
            continue
        if not (r.get("posizione") or "").strip():
            continue
        out.append(
            {
                "posizione": _parse_int_strict(r.get("posizione", ""), "posizione"),
                "giocante_id": _required(r, "giocante_id"),
                "sv": _parse_int_strict(r.get("sv", ""), "sv"),
                "punti": _parse_int_strict(r.get("punti", ""), "punti"),
                "partite_giocate": _parse_int_strict(r.get("partite_giocate", ""), "partite_giocate"),
                "partite_totali": _parse_int_strict(r.get("partite_totali", ""), "partite_totali"),
            }
        )
    return out


def _convert_partite(rows: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for r in rows:
        if not (r.get("id") or "").strip():
            continue
        out.append(
            {
                "id": _required(r, "id"),
                "giocante_a_id": _required(r, "giocante_a_id"),
                "giocante_b_id": _required(r, "giocante_b_id"),
                "set_a": _to_int_or_none(r.get("set_a", "")),
                "set_b": _to_int_or_none(r.get("set_b", "")),
                "punti_a_set_1": _to_int_or_none(r.get("punti_a_set_1", "")),
                "punti_b_set_1": _to_int_or_none(r.get("punti_b_set_1", "")),
                "punti_a_set_2": _to_int_or_none(r.get("punti_a_set_2", "")),
                "punti_b_set_2": _to_int_or_none(r.get("punti_b_set_2", "")),
                "stato": _required(r, "stato"),
            }
        )
    return out


def _conference_dirs(csv_root: Path, year: str) -> Iterable[Tuple[str, Path]]:
    year_dir = csv_root / year
    if not year_dir.exists():
        return []
    for p in sorted(year_dir.iterdir()):
        if p.is_dir():
            yield p.name, p


def main(argv: List[str]) -> int:
    year = argv[1] if len(argv) > 1 else "2026"
    repo_root = Path(__file__).resolve().parents[2]
    csv_root = repo_root / "data" / "csv"
    conferenze_json = repo_root / "assets" / "data" / "stagione-regolare" / year / "conferenze.json"
    if not conferenze_json.exists():
        print(f"ERRORE: conferenze.json non trovato: {conferenze_json}", file=sys.stderr)
        return 2

    conferences = _load_conferences(conferenze_json)

    written = 0
    for conf_id, conf_dir in _conference_dirs(csv_root, year):
        if conf_id not in conferences:
            print(f"WARN: conferenza_id {conf_id!r} presente nei CSV ma non in conferenze.json")
            continue

        conf_name = conferences[conf_id].nome
        out_dir = repo_root / "assets" / "data" / "stagione-regolare" / year / conf_id

        giocanti_csv = conf_dir / "giocanti.csv"
        classifica_csv = conf_dir / "classifica.csv"
        partite_csv = conf_dir / "partite.csv"

        if giocanti_csv.exists():
            giocanti_rows = _normalize_rows(_read_csv_rows(giocanti_csv))
            _write_json(out_dir / "giocanti.json", _convert_giocanti(giocanti_rows, conf_name))
            written += 1

        if classifica_csv.exists():
            classifica_rows = _normalize_rows(_read_csv_rows(classifica_csv))
            _write_json(out_dir / "classifica.json", _convert_classifica(classifica_rows))
            written += 1

        if partite_csv.exists():
            partite_rows = _normalize_rows(_read_csv_rows(partite_csv))
            _write_json(out_dir / "partite.json", _convert_partite(partite_rows))
            written += 1

    print(f"OK: JSON aggiornati da CSV: {written}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv))
    except ValueError as e:
        print(f"ERRORE import CSV: {e}", file=sys.stderr)
        raise SystemExit(1)

