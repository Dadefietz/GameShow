// LA FLAMME — géométrie unique de la marque (chantier v2, décision 5.1).
//
// POURQUOI CE FICHIER EXISTE. Le projet faisait vivre TROIS exemplaires du même
// dessin, recopiés à la main :
//   - l'icône d'onglet, dans index.html — grille 32, trait 2,6, avec plaque ;
//   - la marque du chargement, dans BrandLoader.jsx — grille 24, trait 2,1 ;
//   - la marque du stream, dans OverlayApp.jsx — grille 24, trait 2,1, plus une
//     escarbille.
// Les deux dernières étaient strictement identiques. La première avait DIVERGÉ,
// sur une autre grille et une autre épaisseur, sans que personne ne s'en aperçoive.
//
// La planche de design est pourtant explicite : « Version animée — flamme qui
// respire, braise qui scintille, escarbille qui monte. La version statique
// n'existe qu'en favicon. » UNE marque, DEUX états. Tant que le dessin est
// recopié, il rediverge.
//
// Ce fichier est la référence. Tout ce qui dessine la flamme part d'ici — et
// pour l'icône d'onglet, qui ne peut pas exécuter de JavaScript, un contrôle
// automatique compare sa géométrie à celle-ci.

export const FLAMME = {
  viewBox: '0 0 24 24',
  trait: 2.1,
  // La flamme elle-même : c'est elle qui « respire » dans l'état animé.
  flamme: 'M12 2.9c3 3.7 4.5 6.1 4.5 8a4.5 4.5 0 01-9 0c0-1.7.9-3.4 2.6-5.2',
  // Deux bûches croisées, immobiles dans les deux états.
  buches: ['M3.4 18.7l17.2-3.5', 'M3.4 15.2l17.2 3.5'],
  // La braise, qui scintille.
  braise: { cx: 12, cy: 12.6, r: 1.5 },
  // L'escarbille qui monte — réservée aux surfaces où la marque a la place de
  // respirer. Elle ne fait pas partie de l'état fixe.
  escarbille: { cx: 15.6, cy: 6.4, r: 0.9 },
};

// L'ÉTAT FIXE, tel qu'il doit apparaître dans l'icône d'onglet. Les couleurs y
// sont écrites en clair, et ce n'est PAS un oubli : une icône d'onglet est un
// document isolé, elle ne lit ni la feuille de style ni les jetons du projet.
// C'est une contrainte du support, pas une entorse à la convention.
export const ICONE = {
  fond: '#332114',   // --c-canvas-2 figé
  trait: '#f59a3c',  // --c-flame figé
  rayon: 5.25,       // --r-m ramené à la grille 24 (14 px sur 32 → 5,25 sur 24)
};

// Le dessin de l'icône d'onglet, produit depuis la géométrie ci-dessus. Le
// contrôle automatique compare ce résultat à ce que contient index.html : ils ne
// peuvent pas diverger sans faire rougir la suite.
export function svgIcone() {
  const { viewBox, trait, flamme, buches, braise } = FLAMME;
  const [, , l, h] = viewBox.split(' ');
  return [
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'>`,
    `<rect width='${l}' height='${h}' rx='${ICONE.rayon}' fill='${ICONE.fond}'/>`,
    `<g stroke='${ICONE.trait}' stroke-width='${trait}' stroke-linecap='round' fill='none'>`,
    `<path d='${flamme}'/>`,
    ...buches.map((d) => `<path d='${d}'/>`),
    '</g>',
    `<circle cx='${braise.cx}' cy='${braise.cy}' r='${braise.r}' fill='${ICONE.trait}'/>`,
    '</svg>',
  ].join('');
}

// L'adresse à poser dans index.html. Une URI de données PORTE SON PROPRE CONTENU :
// changer le dessin change l'adresse, donc le cache de favicon — agressif dans
// tous les navigateurs — est contourné par construction. C'est la décision 5.9,
// tenue sans rien ajouter.
export function hrefIcone() {
  return `data:image/svg+xml,${svgIcone()
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/#/g, '%23')}`;
}
