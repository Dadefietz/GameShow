// LE CLAVIER DU TÉLÉPHONE NE DOIT JAMAIS CACHER LA SAISIE (27/09).
//
// CE QUI A ÉTÉ RAPPORTÉ : « lorsqu'en tant que joueur on saisit un texte dans la
// zone de saisie et que son clavier apparaît sur mobile, il va venir cacher la
// zone de saisie ». Vu dans « Cache-cache » ; le même écran porte « Le lien »,
// « Estimation » et l'accueil (code, pseudo).
//
// POURQUOI LE NAVIGATEUR NE S'EN CHARGE PAS. Sur iPhone, le clavier ne
// redimensionne pas la page : il se POSE DESSUS, et seule la partie visible —
// le « visual viewport » — rétrécit. Le navigateur fait alors défiler la page
// pour amener le champ en vue… s'il y a de quoi défiler. Or nos écrans de jeu
// font EXACTEMENT la hauteur de l'écran (`min-height: 100dvh`), le formulaire
// poussé en bas : rien ne défile, et le champ reste sous le clavier. Android,
// depuis Chrome 108, fait pareil par défaut.
//
// CE QUE FAIT CE MODULE. Il suit la zone RÉELLEMENT visible et pose deux choses
// sur <html> :
//   — `--vv-h` et `--vv-top` : la hauteur et le décalage de cette zone ;
//   — `data-clavier="ouvert"` quand un champ de saisie a le focus ET que la zone
//     visible a nettement rétréci — c'est-à-dire quand un clavier est là.
// La feuille de style de l'écran joueur cale alors l'écran sur cette zone, et
// resserre ce qui peut l'être (voir `play.css`, « LE CLAVIER EST OUVERT ») : la
// question, le champ et le bouton d'envoi tiennent ensemble au-dessus du
// clavier.
//
// POURQUOI « NETTEMENT RÉTRÉCI » ET PAS « UN CHAMP A LE FOCUS ». Une tablette
// avec un clavier physique, un ordinateur : le focus y est, le clavier virtuel
// non. Resserrer l'écran pour rien y ferait disparaître l'en-tête sans raison.
// La référence est la plus grande hauteur vue SANS saisie en cours : sur
// Android, où la page entière rétrécit avec le clavier, `innerHeight` baisse
// aussi et ne peut pas servir d'étalon.
const SEUIL_CLAVIER = 120;   // px — une barre d'adresse qui se replie n'en fait pas autant

const TYPES_SANS_CLAVIER = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color', 'image']);

export function estSaisie(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !TYPES_SANS_CLAVIER.has(String(el.type || 'text').toLowerCase());
}

// LA DÉCISION, SÉPARÉE DU NAVIGATEUR pour pouvoir être éprouvée sans lui.
export function clavierOuvert({ saisie, hauteurVisible, hauteurReference }) {
  return !!saisie && hauteurReference - hauteurVisible > SEUIL_CLAVIER;
}

export function suivreLeClavier(fenetre = window) {
  const doc = fenetre.document;
  const racine = doc.documentElement;
  const vv = fenetre.visualViewport || null;
  let reference = vv ? vv.height : fenetre.innerHeight;
  let orientation = fenetre.innerWidth > fenetre.innerHeight ? 'paysage' : 'portrait';
  let image = 0;
  // UN DOIGT EST POSÉ. Toucher « Envoyer » clavier ouvert retire le focus au
  // champ : sur Android, le clavier descend PENDANT le geste. Si l'écran se
  // relâchait à cet instant, le bouton glisserait sous le doigt et le toucher
  // tomberait à côté — le premier appui sur « Envoyer » ne ferait rien. L'écran
  // reste donc figé tant que le doigt est posé, et se libère au lever.
  let appui = false;

  const mesurer = () => {
    image = 0;
    if (appui && racine.dataset.clavier === 'ouvert') return;
    const h = vv ? vv.height : fenetre.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    const actif = doc.activeElement;
    const saisie = estSaisie(actif);
    // L'étalon suit la fenêtre tant qu'on ne tape pas — et repart de zéro quand
    // le téléphone tourne : la hauteur d'un paysage n'est pas celle d'un portrait.
    const o = fenetre.innerWidth > fenetre.innerHeight ? 'paysage' : 'portrait';
    if (o !== orientation) { orientation = o; reference = h; }
    if (!saisie) reference = h;
    const ouvert = clavierOuvert({ saisie, hauteurVisible: h, hauteurReference: reference });
    racine.style.setProperty('--vv-h', `${Math.round(h)}px`);
    racine.style.setProperty('--vv-top', `${Math.round(top)}px`);
    if (ouvert) {
      if (racine.dataset.clavier !== 'ouvert') {
        racine.dataset.clavier = 'ouvert';
        // LE CHAMP DANS LA ZONE VISIBLE, une fois l'écran recalé : si la place
        // manque malgré le resserrement, c'est l'écran qui défile, pas la page.
        fenetre.requestAnimationFrame(() => actif?.scrollIntoView?.({ block: 'nearest' }));
      }
    } else if (racine.dataset.clavier) {
      delete racine.dataset.clavier;
    }
  };
  const planifier = () => { if (!image) image = fenetre.requestAnimationFrame(mesurer); };
  // À LA PERTE DU FOCUS, on attend que le suivant soit posé : passer du code au
  // pseudo n'est pas fermer le clavier, et l'écran ne doit pas sauter entre les deux.
  const auFocusPerdu = () => fenetre.setTimeout(planifier, 60);

  const poser = () => { appui = true; };
  const lever = () => { appui = false; planifier(); };

  vv?.addEventListener('resize', planifier);
  doc.addEventListener('pointerdown', poser, true);
  doc.addEventListener('pointerup', lever, true);
  doc.addEventListener('pointercancel', lever, true);
  vv?.addEventListener('scroll', planifier);
  fenetre.addEventListener('resize', planifier);
  doc.addEventListener('focusin', planifier);
  doc.addEventListener('focusout', auFocusPerdu);
  mesurer();

  return () => {
    vv?.removeEventListener('resize', planifier);
    doc.removeEventListener('pointerdown', poser, true);
    doc.removeEventListener('pointerup', lever, true);
    doc.removeEventListener('pointercancel', lever, true);
    vv?.removeEventListener('scroll', planifier);
    fenetre.removeEventListener('resize', planifier);
    doc.removeEventListener('focusin', planifier);
    doc.removeEventListener('focusout', auFocusPerdu);
    if (image) fenetre.cancelAnimationFrame(image);
    delete racine.dataset.clavier;
  };
}
