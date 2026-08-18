#!/usr/bin/env python3
"""Extrait le champ .content du dernier resultat d'outil persiste vers un fichier."""
import json, pathlib, sys, glob, os

DEST = sys.argv[1]
TOOLDIR = ("/Users/mathis/.claude/projects/-Users-mathis-Documents-MonVault-Ateliers-theo/"
           "c0d3a47e-0aba-4308-90e3-1e42be8277f0/tool-results")
files = sorted(glob.glob(os.path.join(TOOLDIR, "*.txt")), key=os.path.getmtime)
if not files:
    sys.exit("aucun resultat persiste")
raw = pathlib.Path(files[-1]).read_text()
start = raw.index('{"method"')
data = json.loads(raw[start:])
out = pathlib.Path(DEST)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(data["content"])
print(f"{data['path']} -> {DEST} : {len(data['content'])} octets, "
      f"{data['content'].count(chr(10))} lignes")
