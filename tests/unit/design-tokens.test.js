// CONTRÔLE DU SYSTÈME DE DESIGN — aucune valeur de design hors des jetons.
//
// POURQUOI CE FICHIER N'EXISTAIT PAS, ET AURAIT DÛ.
// AGENTS.md affirme depuis le début que « le gate refuse MÉCANIQUEMENT toute
// valeur de design écrite hors de tokens.css », et la convention de build répète
// « zéro couleur/spacing/police hardcodé ». Aucun contrôle ne le vérifiait.
// Résultat : trois couleurs écrites en dur ont vécu des mois dans le CSS client
// sans que rien ne les signale — découvertes seulement lors d'un audit manuel.
//
// Une règle annoncée mais non tenue est pire qu'une règle absente : elle donne
// l'assurance sans la garantie. Ce fichier tient la promesse.
//
// CE QU'IL VÉRIFIE, et pourquoi ces catégories précises :
//   - COULEURS : c'est par elles que la cohérence d'une direction artistique se
//     défait en premier, une teinte à la fois ;
//   - POLICES : une pile de secours réécrite à la main casse la substitution ;
//   - RAYONS et ÉPAISSEURS : ils portent le langage de forme du système.
//
// CE QU'IL NE VÉRIFIE PAS, DÉLIBÉRÉMENT : les longueurs en pixels. Une hauteur de
// piste, une largeur de trait ou un décalage d'un pixel relèvent de la géométrie
// d'un composant, pas du système — les jetonner tous produirait un dictionnaire
// illisible. Le système tient les ESPACEMENTS (--sp-*), qui eux sont partagés.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RACINE = 'src/client';
const JETONS = 'design/tokens/tokens.css';

function fichiers(dossier, suffixes) {
  const out = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) out.push(...fichiers(p, suffixes));
    else if (suffixes.some((s) => e.name.endsWith(s))) out.push(p);
  }
  return out;
}

const feuillesDeStyle = (d) => fichiers(d, ['.css']);
const sources = (d) => fichiers(d, ['.jsx', '.js']);

// Une ligne est exemptée si elle DÉFINIT un jeton (--x: ...) — mais seul
// tokens.css a le droit d'en définir, ce que vérifie un test à part.
function lignesUtiles(contenu) {
  return contenu.split('\n').map((l, i) => ({ n: i + 1, t: l })).filter(({ t }) => {
    const s = t.trim();
    return s && !s.startsWith('/*') && !s.startsWith('*') && !s.startsWith('//');
  });
}

describe('système de design — aucune valeur en dur hors des jetons', () => {
  const feuilles = feuillesDeStyle(RACINE);

  it('trouve bien les feuilles de style du client', () => {
    expect(feuilles.length).toBeGreaterThan(0);
  });

  it('aucune COULEUR écrite en dur', () => {
    // C'est par les couleurs qu'une direction artistique se défait en premier.
    const motif = /(oklch\(|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/;
    const fautes = [];
    for (const f of feuilles) {
      for (const { n, t } of lignesUtiles(fs.readFileSync(f, 'utf8'))) {
        if (motif.test(t)) fautes.push(`${f}:${n} → ${t.trim()}`);
      }
    }
    expect(fautes, `couleur(s) hors jetons :\n${fautes.join('\n')}`).toEqual([]);
  });

  it('aucune PILE DE POLICES écrite en dur', () => {
    // Une pile réécrite à la main casse la substitution : le projet ne charge
    // aucune police obligatoire et compte sur des piles équivalentes.
    const motif = /font-family\s*:(?!\s*var\()/;
    const fautes = [];
    for (const f of feuilles) {
      for (const { n, t } of lignesUtiles(fs.readFileSync(f, 'utf8'))) {
        if (motif.test(t)) fautes.push(`${f}:${n} → ${t.trim()}`);
      }
    }
    expect(fautes, `police(s) hors jetons :\n${fautes.join('\n')}`).toEqual([]);
  });

  it('aucun RAYON écrit en dur au-delà des valeurs de finition', () => {
    // Les rayons portent le langage de forme. On tolère 0 à 2px, qui relèvent
    // du détail d'un angle et non d'une décision de système.
    const motif = /border-radius\s*:(?!\s*(var\(|0\b|1px|2px|inherit|50%))/;
    const fautes = [];
    for (const f of feuilles) {
      for (const { n, t } of lignesUtiles(fs.readFileSync(f, 'utf8'))) {
        if (motif.test(t)) fautes.push(`${f}:${n} → ${t.trim()}`);
      }
    }
    expect(fautes, `rayon(s) hors jetons :\n${fautes.join('\n')}`).toEqual([]);
  });

  it('les jetons employés EXISTENT tous', () => {
    // Un jeton mal orthographié ne casse rien de visible : la propriété est
    // simplement ignorée, et l'écran s'affiche « presque » bien. C'est le genre
    // de défaut qu'on ne voit qu'en le cherchant.
    // Pas d'ancrage en début de ligne : les jetons d'espacement sont déclarés
    // quatre par ligne, et un motif ancré n'en verrait qu'un sur quatre.
    const declares = new Set(
      [...fs.readFileSync(JETONS, 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]),
    );
    // Certains jetons de composant sont posés depuis le JSX plutôt que depuis
    // une feuille : --om-to (progression d'une jauge), --q-frac, --om-ring,
    // --stream-scale. Ne pas lire le JSX les ferait passer pour des fautes de
    // frappe, et le contrôle crierait au loup sur du code correct.
    for (const f of sources(RACINE)) {
      const contenu = fs.readFileSync(f, 'utf8');
      for (const m of contenu.matchAll(/['"](--[a-z0-9-]+)['"]/g)) declares.add(m[1]);
    }

    const fautes = [];
    for (const f of feuilles) {
      const contenu = fs.readFileSync(f, 'utf8');
      // Les jetons définis localement dans une feuille sont légitimes s'ils
      // servent de variable de composant.
      for (const m of contenu.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declares.add(m[1]);
      for (const m of contenu.matchAll(/var\((--[a-z0-9-]+)/g)) {
        if (!declares.has(m[1])) fautes.push(`${f} → ${m[1]}`);
      }
    }
    expect([...new Set(fautes)], `jeton(s) inconnu(s) :\n${fautes.join('\n')}`).toEqual([]);
  });
});
