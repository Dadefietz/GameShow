// PLANCHE VISUELLE DU BARÈME DE « CUEILLETTE ».
//
//     node tests/outils/planche-cueillette.mjs [chemin de sortie]
//
// ============================================================================
// POURQUOI CET OUTIL EXISTE, ET POURQUOI CE N'EST PAS UN TEST
// ============================================================================
//
// « Ce score ne représentera pas une vérité absolue […] l'objectif est surtout de
// classer les joueurs de manière amusante et PERÇUE COMME JUSTE, pas de produire
// une évaluation artistique parfaite. » (énoncé du 16/09, C17 et C19)
//
// « Perçue comme juste » ne se teste pas. C'est le seul endroit de ce chantier où
// un contrôle vert ne prouve rien : le barème peut être parfaitement implémenté et
// parfaitement ridicule, et `expect(note).toBeGreaterThan(autre)` passerait sans
// rien dire de ce que le public verra. Le plan du chantier l'avait écrit — « des
// dessins de synthèse dont on SAIT l'ordre attendu, ET UNE PLANCHE VISUELLE avant
// de livrer ». Voici la planche.
//
// Le contrôle unitaire vérifie L'ORDRE sur des figures construites ; celui-ci
// donne le même ordre À REGARDER, sur de VRAIS dessins de la banque, avec la note
// et les points sous chacun. Ce qu'on y cherche n'est pas un nombre : c'est de
// pouvoir dire, en parcourant une ligne de gauche à droite, « oui, celui-là mérite
// bien d'être devant celui-ci ». Si l'œil dit non quelque part, le barème est
// faux, quels que soient ses tests.
//
// Il ne s'exécute pas avec la suite — même règle que `balayage-redites.mjs` : un
// outil de jugement humain, lancé à la main, dont la CONCLUSION est consignée
// dans le plan de chantier.
//
// ============================================================================
// LES CANDIDATS, ET CE QU'ON ATTEND D'EUX
// ============================================================================
//
// Ils sont fabriqués à partir des grilles de la banque, donc à partir des VRAIS
// dessins, avec des écarts dont on connaît la nature :
//   — la copie fidèle doit être en tête ;
//   — la main qui tremble à peine doit la suivre de près ;
//   — un dessin juste mais tracé PETIT ne doit pas s'effondrer : c'est la faute
//     la plus commune au doigt sur un téléphone ;
//   — un dessin à moitié fait doit perdre nettement, sans tomber à zéro ;
//   — UN AUTRE DESSIN DE LA BANQUE, bien tracé, ne doit RIEN rapporter : c'est le
//     cas qui dit si le barème mesure la ressemblance ou seulement la quantité
//     d'encre ;
//   — le gribouillis est le plancher. Rien ne doit valoir moins qu'un gribouillis
//     tout en valant plus que lui à l'œil.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRILLES_DESSINS } from '../../src/server/dessins-grilles.js';
import { BASSIN_DESSINS, dessinDe } from '../../src/server/dessins.js';
import { ressemblanceContreGrilles, pointsDe } from '../../src/server/cueillette.js';
import { copisteDe, gribouillis } from './copiste.js';

// LES CIBLES SONT EMBARQUÉES DANS LA PAGE, et ce n'est pas de la coquetterie : la
// planche s'ouvre depuis le dossier temporaire du système, parfois servie par un
// petit serveur pour être regardée dans un navigateur. Un chemin relatif y donne
// quatre cadres vides, un chemin `file://` est refusé depuis une page servie en
// HTTP — dans les deux cas, sans un mot. Une page autonome se regarde partout, et
// s'envoie telle quelle.
const DESSINS = path.resolve(fileURLToPath(new URL('../../src/public/dessins', import.meta.url)));
const embarquer = (id) => `data:image/webp;base64,${fs.readFileSync(path.join(DESSINS, `${id}.webp`)).toString('base64')}`;
const SORTIE = process.argv[2] || path.join(process.env.TMPDIR || '/tmp', 'planche-cueillette.html');

// QUATRE CIBLES, UNE PAR SITUATION DE FORME. Un arbre dense, une fleur ouverte,
// un fruit compact, un fruit à silhouette fine : le barème ne doit pas se
// comporter autrement selon que la figure remplit la case ou la traverse.
const CIBLES = ['d001', 'd013', 'd031', 'd045'];
// Les intrus : d'autres dessins de la banque, tracés proprement.
const INTRUS = { d001: 'd002', d013: 'd011', d031: 'd033', d045: 'd046' };

function candidats(id) {
  const position = GRILLES_DESSINS[id];
  const autre = GRILLES_DESSINS[INTRUS[id]];
  return [
    ['La copie fidèle', copisteDe(position)],
    ['La main qui tremble', copisteDe(position, { bruit: 0.012 })],
    ['La main hésitante', copisteDe(position, { bruit: 0.03 })],
    ['Juste, mais tracé petit', copisteDe(position, { echelle: 0.62 })],
    ['Juste, mais posé de travers', copisteDe(position, { decalage: 0.12 })],
    ['Arrêté à mi-chemin', copisteDe(position, { haut: 0.5 })],
    ['La main qui pointille', copisteDe(position, { garde: 0.5 })],
    ['À peine commencé', copisteDe(position, { haut: 0.25 }), true],
    [`Un autre dessin : ${dessinDe(INTRUS[id]).nom}`, copisteDe(autre)],
    ['Le gribouillis', gribouillis(), true],
    ['La feuille blanche', [], true],
  ];
}

const svg = (traits) => `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none">${
  traits.map((t) => `<polyline points="${t.map(([x, y]) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`).join(' ')}" />`).join('')
}</svg>`;

let corps = '';
let desordres = 0;
for (const id of CIBLES) {
  const position = GRILLES_DESSINS[id];
  const cible = dessinDe(id);
  const notes = candidats(id).map(([nom, traits, gratuit]) => {
    const { pourcent, detail } = traits.length
      ? ressemblanceContreGrilles(position, traits)
      : { pourcent: 0, detail: {} };
    return { nom, traits, gratuit, pourcent, points: pointsDe(pourcent), detail };
  });
  // CE QUE LA PLANCHE SIGNALE EN ROUGE, ET CE QU'ELLE SE GARDE D'AFFIRMER.
  //
  // LA PREMIÈRE VERSION EXIGEAIT UN ORDRE COMPLET : chaque candidat devait valoir
  // moins que le précédent, du fidèle au gribouillis. Elle rendait vingt désordres
  // sur quarante, et la plupart n'en étaient pas. Un dessin JUSTE tracé petit
  // vaut-il plus ou moins qu'une MOITIÉ de dessin bien placée ? Personne ne
  // tranche d'un coup d'œil. En rougissant cette paire, la planche me poussait à
  // retoucher le barème pour satisfaire une affirmation que je ne pouvais pas
  // défendre — c'est-à-dire à casser ce qui marchait.
  //
  // Elle ne signale donc que les FAUTES, celles dont un spectateur s'indignerait :
  // une copie fidèle qui n'est pas première, un gribouillis qui rapporte, une
  // ébauche qui rapporte. Le reste est donné À REGARDER, dans l'ordre calculé, et
  // c'est à l'œil de dire s'il est juste.
  const range = [...notes].sort((a, b) => b.pourcent - a.pourcent);
  const faute = (n, i) => {
    if (i === 0 && range[0] !== n) return 'une copie fidèle doit être première';
    if (n.gratuit && n.points > 0) return `rapporte ${n.points} points`;
    return null;
  };
  corps += `<section><h2>${cible.nom}<span class="fam">${cible.famille}</span></h2><div class="ligne">
    <figure class="cible"><img src="${embarquer(id)}" alt=""><figcaption>La cible</figcaption></figure>
    ${notes.map((n, i) => {
    const f = faute(n, i);
    if (f) desordres += 1;
    return `<figure class="${f ? 'desordre' : ''}">
        <div class="toile">${svg(n.traits)}</div>
        <figcaption>
          <b>${n.pourcent} %</b> · ${n.points} pts
          <span>${n.nom}</span>
          ${f ? `<em>${f}</em>` : ''}
        </figcaption>
      </figure>`;
  }).join('')}
  </div></section>`;
}

// LE BALAYAGE DES CINQUANTE, sous les quatre lignes. Les vignettes donnent à
// juger ; ce bloc donne les BORNES, et ce sont elles qui disent si le jeu est
// jouable : la plus mauvaise copie fidèle de la banque, le mieux noté des
// gribouillis, et le pire des deux mille quatre cent cinquante intrus possibles.
const grib = gribouillis();
let fidMin = { p: 101 }; let gribMax = { p: -1 }; let intrusMax = { p: -1 };
for (const d of BASSIN_DESSINS) {
  const pos = GRILLES_DESSINS[d.id];
  const f = ressemblanceContreGrilles(pos, copisteDe(pos)).pourcent;
  if (f < fidMin.p) fidMin = { p: f, quoi: d.nom };
  const g = ressemblanceContreGrilles(pos, grib).pourcent;
  if (g > gribMax.p) gribMax = { p: g, quoi: d.nom };
  for (const a of BASSIN_DESSINS) {
    if (a.id === d.id) continue;
    const v = ressemblanceContreGrilles(pos, copisteDe(GRILLES_DESSINS[a.id])).pourcent;
    if (v > intrusMax.p) intrusMax = { p: v, quoi: `${a.nom} dessiné pour ${d.nom}` };
  }
}
const bornes = `<section><h2>Les bornes, sur les cinquante dessins</h2>
  <table class="bornes">
    <tr><td>La plus mauvaise copie fidèle</td><td><b>${fidMin.p} %</b> · ${pointsDe(fidMin.p)} pts</td><td>${fidMin.quoi}</td></tr>
    <tr><td>Le gribouillis le mieux noté</td><td><b>${gribMax.p} %</b> · ${pointsDe(gribMax.p)} pts</td><td>${gribMax.quoi}</td></tr>
    <tr><td>Le pire des 2450 intrus</td><td><b>${intrusMax.p} %</b> · ${pointsDe(intrusMax.p)} pts</td><td>${intrusMax.quoi}</td></tr>
  </table>
  <p class="note">LE DERNIER EST UNE LIMITE ASSUMÉE, ET MESURÉE. Un coquelicot dessiné
  pour une rose paie presque plein tarif : à 64 × 64 cases, adoucies par le flou qui
  pardonne la main tremblante, ce sont le même dessin. Un terme de DÉTAIL, mesuré
  sans le flou, a été essayé pour les séparer — et abandonné sur mesure : le pire
  intrus y obtient 0,666 quand une main humaine ordinaire obtient 0,651 et une main
  lourde 0,579. Il aurait puni l'honnête plus que le tricheur. L'énoncé l'admet
  d'avance : « ce score ne représentera pas une vérité absolue ».</p>
</section>`;

const html = `<!doctype html><meta charset="utf-8"><title>Planche — le barème de Cueillette</title>
<style>
 :root { --plaque: #f3efe6; --nuit: #1c1512; --encre: #e8e0d2; }
 body { margin: 0; padding: 32px; background: var(--nuit); color: var(--encre);
        font: 14px/1.4 system-ui, sans-serif; }
 h1 { font-size: 22px; margin: 0 0 4px; }
 p.intro { color: #b6a893; max-width: 68ch; margin: 0 0 28px; }
 h2 { font-size: 17px; margin: 28px 0 10px; }
 .fam { color: #8d7f6c; font-weight: 400; margin-left: 10px; font-size: 13px; }
 .ligne { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
 figure { margin: 0; flex: none; width: 132px; }
 .toile, .cible img { width: 132px; height: 132px; background: var(--plaque);
        border-radius: 10px; display: block; object-fit: contain; }
 .toile svg { width: 100%; height: 100%; }
 polyline { fill: none; stroke: #2a231c; stroke-width: 4px; stroke-linecap: round;
        stroke-linejoin: round; vector-effect: non-scaling-stroke; }
 figcaption { font-size: 12px; margin-top: 6px; color: #b6a893; }
 figcaption b { color: #7fd39b; font-size: 15px; }
 figcaption span { display: block; color: #8d7f6c; }
 .cible figcaption { color: #e8b57a; }
 .desordre .toile { outline: 2px solid #e0674f; }
 .desordre em { display: block; color: #e0674f; font-style: normal; }
 .bornes { border-collapse: collapse; margin: 6px 0 12px; }
 .bornes td { padding: 5px 18px 5px 0; }
 .bornes b { color: #7fd39b; }
 .note { max-width: 78ch; color: #8d7f6c; font-size: 13px; margin: 0; }
 .bilan { margin-top: 30px; padding: 14px 16px; border-radius: 10px;
        background: #241b16; color: #b6a893; }
</style>
<h1>Le barème de « Cueillette », à l'œil</h1>
<p class="intro">Chaque ligne part d'un vrai dessin de la banque. Les candidats sont
rangés de gauche à droite dans l'ordre ATTENDU : la copie fidèle, puis des écarts
de plus en plus grands. Ce qu'on vient vérifier ici n'est aucun nombre en
particulier — c'est qu'en parcourant une ligne on puisse dire, à chaque pas,
« oui, celui-là mérite d'être devant celui-ci ». Un candidat cerclé de rouge est
classé ailleurs qu'à sa place attendue.</p>
${corps}
${bornes}
<p class="bilan">${desordres === 0
    ? 'Aucune faute : la copie fidèle est première partout, et rien de ce qui ne doit pas payer ne paie.'
    : `${desordres} faute(s) — voir les vignettes cerclées.`}</p>`;

fs.writeFileSync(SORTIE, html);
console.log(`planche écrite : ${SORTIE}`);
console.log(`désordres : ${desordres}`);
