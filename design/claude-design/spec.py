#!/usr/bin/env python3
"""Extrait l'arbre d'un canvas de maquette avec ses styles inline = la spec."""
import sys, re
from html.parser import HTMLParser

KEEP = ("background","box-shadow","border-radius","padding","gap","font","min-height",
        "height","width","color","border","letter-spacing","text-transform","grid-template")

class T(HTMLParser):
    def __init__(self, want):
        super().__init__(); self.d=0; self.want=want; self.on=False; self.depth0=0
        self.out=[]; self.stack=[]; self.buf=""; self.svg=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); self.d+=1
        if tag=="svg": self.svg+=1
        if self.svg: self.stack.append(tag); return
        lbl=a.get("data-screen-label","")
        if not self.on and lbl==self.want:
            self.on=True; self.depth0=self.d
        if self.on:
            st=a.get("style","")
            props=[p.strip() for p in st.split(";") if p.strip()]
            props=[p for p in props if any(p.startswith(k) for k in KEEP)]
            meta=[]
            for k in ("data-bind","data-action","data-testid","data-state","role","aria-label"):
                if a.get(k): meta.append(f'{k}="{a[k]}"')
            ind="  "*(self.d-self.depth0)
            self.out.append((self.d, f'{ind}<{tag}> {" ".join(meta)}'))
            for p in props:
                self.out.append((self.d, f'{ind}   {p}'))
        self.stack.append(tag)
    def handle_endtag(self, tag):
        if tag=="svg" and self.svg: self.svg-=1
        if self.svg: self.d-=1; self.stack and self.stack.pop(); return
        if self.on and self.d==self.depth0: self.on=False
        self.d-=1
        if self.stack: self.stack.pop()
    def handle_data(self, data):
        t=data.strip()
        if self.on and not self.svg and t and len(t)<60:
            self.out.append((self.d, "  "*(self.d-self.depth0)+f'   TEXTE: "{t}"'))

src=open(sys.argv[1]).read()
p=T(sys.argv[2]); p.feed(src)
for _,l in p.out: print(l)
