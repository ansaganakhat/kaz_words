#!/usr/bin/env python3
"""Compile a reviewed CSV into a GitHub Pages catalog extension.

Usage: python3 tools/build_catalog.py reviewed_terms.csv
The CSV must contain: category,kk,kk_alt,ru,en,wiki
"""

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

CATEGORIES = {"hardware", "network", "software", "programming", "data", "security", "ai", "other"}
FIELDS = {"category", "kk", "kk_alt", "ru", "en", "wiki"}


def variants(value):
    output = []
    seen = set()
    for item in re.split(r"[;，]", value or ""):
        text = item.strip()
        if text and text.casefold() not in seen:
            if len(text) > 90:
                raise ValueError(f"Атау 90 таңбадан ұзын: {text[:30]}")
            seen.add(text.casefold())
            output.append(text)
    return output[:5]


def compile_file(source, output):
    with source.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or not FIELDS.issubset(reader.fieldnames):
            raise ValueError("CSV бағандары: category,kk,kk_alt,ru,en,wiki")
        terms = []
        seen = set()
        for line, row in enumerate(reader, 2):
            kk = variants(";".join([row["kk"] or "", row["kk_alt"] or ""]))
            ru = variants(row["ru"] or "")
            en = (row["en"] or "").strip()
            wiki = (row["wiki"] or "").strip()
            category = (row["category"] or "other").strip()
            if not kk or len(en) > 90:
                raise ValueError(f"{line}-жол: қазақша атау керек; ағылшынша атау 90 таңбадан аспасын")
            if category not in CATEGORIES:
                raise ValueError(f"{line}-жол: белгісіз санат: {category}")
            identity = "|".join((en.casefold(), kk[0].casefold(), (ru or [""])[0].casefold()))
            token = re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")[:55]
            identifier = "user-" + (token or "term") + "-" + hashlib.sha256(identity.encode()).hexdigest()[:9]
            if identifier in seen:
                raise ValueError(f"{line}-жол: қайталанған ұғым: {kk[0]}")
            seen.add(identifier)
            terms.append({"id": identifier, "category": category, "kk": kk, "ru": ru, "en": en, "wiki": wiki, "sourceType": "редактор тексерген CSV"})
            if len(terms) > 20000:
                raise ValueError("Бір файлдағы шек: 20 000 термин")
    output.write_text('"use strict";\nwindow.UserCatalog = ' + json.dumps(terms, ensure_ascii=True, separators=(",", ":")) + ";\n", encoding="utf-8")
    return len(terms)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    source_path = Path(sys.argv[1])
    output_path = Path(__file__).resolve().parents[1] / "catalog-user.js"
    try:
        count = compile_file(source_path, output_path)
        print(f"{count} термин жазылды: {output_path}")
    except (OSError, ValueError) as error:
        raise SystemExit(str(error)) from error
