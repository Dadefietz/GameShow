// LE CLAVIER DU TÉLÉPHONE NE CACHE PAS LA SAISIE — la décision, éprouvée sur les
// deux façons dont un téléphone ouvre son clavier.
//
// POURQUOI UNE FENÊTRE FACTICE. Aucun navigateur de contrôle n'ouvre de clavier
// virtuel, et le modèle de l'iPhone — la page GARDE sa hauteur, seule la zone
// visible rétrécit — ne se reproduit pas dans Chrome, où rétrécir la fenêtre
// rétrécit tout. Or c'est l'iPhone qui a montré le défaut (capture de l'auteur,
// Safari). La fenêtre factice le décrit exactement : `innerHeight` reste à 874,
// `visualViewport.height` tombe à 440. Le modèle d'Android, lui, est éprouvé en
// vrai, de bout en bout (`tests/e2e/clavier-mobile.spec.js`).
import { describe, it, expect } from 'vitest';
import { estSaisie, clavierOuvert, suivreLeClavier } from '../../src/client/shared/clavier.js';

function champ(type = 'text') {
  return { tagName: 'INPUT', type, vus: 0, scrollIntoView() { this.vus += 1; } };
}

function fausseFenetre({ largeur = 402, hauteur = 874 } = {}) {
  const images = [];
  const minuteries = [];
  const doc = new EventTarget();
  const props = {};
  doc.documentElement = { dataset: {}, style: { setProperty: (k, v) => { props[k] = v; } } };
  doc.activeElement = { tagName: 'BODY' };
  const vv = new EventTarget();
  vv.height = hauteur;
  vv.offsetTop = 0;
  const f = new EventTarget();
  Object.assign(f, {
    document: doc,
    visualViewport: vv,
    innerWidth: largeur,
    innerHeight: hauteur,
    requestAnimationFrame: (cb) => { images.push(cb); return images.length; },
    cancelAnimationFrame: () => {},
    setTimeout: (cb) => { minuteries.push(cb); return minuteries.length; },
  });
  // Le temps avance : les minuteries, puis les images, jusqu'à ce que tout soit calme.
  const tourner = () => {
    for (let n = 0; n < 10 && (minuteries.length || images.length); n += 1) {
      minuteries.splice(0).forEach((cb) => cb());
      images.splice(0).forEach((cb) => cb());
    }
  };
  const etat = () => ({ ouvert: doc.documentElement.dataset.clavier === 'ouvert', h: props['--vv-h'], top: props['--vv-top'] });
  const focus = (el) => { doc.activeElement = el; doc.dispatchEvent(new Event('focusin')); tourner(); };
  const blur = () => { doc.activeElement = { tagName: 'BODY' }; doc.dispatchEvent(new Event('focusout')); tourner(); };
  const zone = (h, top = 0) => { vv.height = h; vv.offsetTop = top; vv.dispatchEvent(new Event('resize')); vv.dispatchEvent(new Event('scroll')); tourner(); };
  return { f, doc, vv, tourner, etat, focus, blur, zone };
}

describe('ce qui appelle un clavier', () => {
  it('les champs de texte et de nombre, pas les cases ni les boutons', () => {
    expect(estSaisie(champ('text'))).toBe(true);
    expect(estSaisie(champ('number'))).toBe(true);
    expect(estSaisie({ tagName: 'TEXTAREA' })).toBe(true);
    expect(estSaisie(champ('checkbox'))).toBe(false);
    expect(estSaisie(champ('submit'))).toBe(false);
    expect(estSaisie({ tagName: 'BUTTON' })).toBe(false);
    expect(estSaisie(null)).toBe(false);
  });

  it('un clavier, c’est un champ ET une zone visible nettement rétrécie', () => {
    expect(clavierOuvert({ saisie: true, hauteurVisible: 440, hauteurReference: 874 })).toBe(true);
    // Une barre d'adresse qui se replie ne fait pas un clavier.
    expect(clavierOuvert({ saisie: true, hauteurVisible: 800, hauteurReference: 874 })).toBe(false);
    // Une zone rétrécie sans champ non plus : c'est un zoom, ou une rotation.
    expect(clavierOuvert({ saisie: false, hauteurVisible: 440, hauteurReference: 874 })).toBe(false);
  });
});

describe('le modèle de l’iPhone — le clavier se POSE sur la page', () => {
  it('l’écran se cale sur la zone visible, et se libère au départ du clavier', () => {
    const t = fausseFenetre();
    const arreter = suivreLeClavier(t.f);
    const c = champ();
    t.focus(c);
    // Le focus seul ne suffit pas : le clavier n'est pas encore monté.
    expect(t.etat().ouvert).toBe(false);
    // Il monte. La page garde sa hauteur (`innerHeight` 874), la zone visible tombe à 440.
    t.zone(440);
    expect(t.etat()).toMatchObject({ ouvert: true, h: '440px' });
    expect(c.vus, 'le champ n’a pas été ramené dans la zone visible').toBeGreaterThan(0);
    // Safari fait glisser la zone visible : l'écran la suit.
    t.zone(440, 120);
    expect(t.etat().top).toBe('120px');
    // Le clavier descend.
    t.blur();
    t.zone(874, 0);
    expect(t.etat()).toMatchObject({ ouvert: false, h: '874px', top: '0px' });
    arreter();
  });

  it('passer d’un champ au suivant ne fait pas sauter l’écran', () => {
    const t = fausseFenetre();
    suivreLeClavier(t.f);
    t.focus(champ());
    t.zone(440);
    // Du code au pseudo : le focus quitte un champ… et en prend un autre avant
    // que la perte ne soit jugée.
    // Comme un navigateur : pendant `focusout`, plus rien n'a le focus.
    t.doc.activeElement = { tagName: 'BODY' };
    t.doc.dispatchEvent(new Event('focusout'));
    t.doc.activeElement = champ();
    t.doc.dispatchEvent(new Event('focusin'));
    t.tourner();
    expect(t.etat().ouvert).toBe(true);
  });

  it('TOUCHER « ENVOYER » : l’écran reste figé tant que le doigt est posé', () => {
    // Le toucher retire le focus au champ et le clavier descend PENDANT le geste.
    // Relâché à cet instant, l'écran ferait glisser le bouton sous le doigt, et
    // le premier appui sur « Envoyer » tomberait à côté.
    const t = fausseFenetre();
    suivreLeClavier(t.f);
    t.focus(champ());
    t.zone(440);
    t.doc.dispatchEvent(new Event('pointerdown'));
    t.blur();
    t.zone(874);
    expect(t.etat(), 'l’écran s’est relâché sous le doigt').toMatchObject({ ouvert: true, h: '440px' });
    t.doc.dispatchEvent(new Event('pointerup'));
    t.tourner();
    expect(t.etat()).toMatchObject({ ouvert: false, h: '874px' });
  });

  it('un clavier PHYSIQUE (tablette, ordinateur) ne resserre rien', () => {
    const t = fausseFenetre({ largeur: 1024, hauteur: 768 });
    suivreLeClavier(t.f);
    t.focus(champ());
    t.zone(768);
    expect(t.etat().ouvert).toBe(false);
  });
});

describe('le modèle d’Android — la page entière rétrécit avec le clavier', () => {
  it('la hauteur d’avant la saisie reste l’étalon', () => {
    const t = fausseFenetre();
    suivreLeClavier(t.f);
    t.focus(champ('number'));
    // Tout rétrécit : la fenêtre ET la zone visible. `innerHeight` ne peut pas
    // servir d'étalon — il a baissé avec le reste.
    t.f.innerHeight = 440;
    t.zone(440);
    expect(t.etat().ouvert).toBe(true);
  });

  it('un téléphone qui tourne repart de sa nouvelle hauteur', () => {
    const t = fausseFenetre();
    suivreLeClavier(t.f);
    // Paysage : 874 de large, 402 de haut.
    t.f.innerWidth = 874; t.f.innerHeight = 402;
    t.zone(402);
    t.focus(champ());
    t.zone(250);
    expect(t.etat().ouvert, 'le clavier en paysage n’a pas été reconnu').toBe(true);
  });
});
