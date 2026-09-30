// LA MUSIQUE D'AMBIANCE DU STREAM — « Feu de camp » (30/09).
//
// « Pour le jeu, dans l'ambiance, j'aimerais un petit fond sonore en mode petite
// musique de camp […] une boucle de 2 min. » La composition et son rendu vivent
// dans `design/audio/feu-de-camp.mjs` ; ce module ne fait que la JOUER.
//
// ELLE NE JOUE QUE SUR LE STREAM. C'est lui que la salle et les spectateurs
// entendent ; la jouer aussi sur quinze téléphones posés dans la même pièce, avec
// quinze décalages, ferait un écho ingérable. La console la RÈGLE, elle ne la
// joue pas.
//
// ============================================================================
// POURQUOI LE WEB AUDIO, ET PAS UNE BALISE <audio loop>
// ============================================================================
//
// Une balise <audio> qui boucle un MP3 laisse un blanc à chaque tour : l'encodeur
// ajoute du silence en tête et en queue, et le lecteur le rejoue. Toutes les deux
// minutes, la veillée s'interromprait d'un hoquet. Le Web Audio boucle à
// l'échantillon près entre deux instants choisis : ici de 1 s à 121 s, dans un
// fichier qui porte UNE SECONDE DE MARGE de part et d'autre (la fin de la boucle
// avant, son début après). Le signal y est périodique : n'importe quelle fenêtre
// de 120 s s'y raccorde, même si le décodeur décale tout de quelques millièmes.
//
// LE NAVIGATEUR RETIENT LE SON SANS GESTE DE L'UTILISATEUR. Dans OBS, la source
// navigateur a le droit de jouer d'office. Dans un onglet ordinaire, la musique
// attend le premier clic ou la première touche sur la page — on ne force rien,
// et l'écran n'en dépend jamais.
export const FICHIER_MUSIQUE = '/audio/feu-de-camp.mp3';
export const MARGE_S = 1;       // design/audio/feu-de-camp.mjs — MARGE
export const BOUCLE_S = 120;    // design/audio/feu-de-camp.mjs — DUREE

// LE VOLUME DU CURSEUR N'EST PAS LE GAIN. L'oreille entend en logarithme : un
// curseur linéaire mettrait toute la plage utile dans son premier quart. Au carré,
// le milieu du curseur donne un quart du gain — la musique sous la voix, là où
// elle doit être — et le haut reste disponible pour une salle bruyante.
export function gainDuVolume(volume) {
  const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  return v * v;
}

// Le lecteur : un contexte, une source qui boucle, un gain qui fait les fondus.
// Rend `{ regler({ active, volume }), arreter() }`. Rien ne jette : une musique
// qui ne peut pas jouer se tait, l'écran continue.
export function lecteurDeMusique(fenetre = window, quandPrete = () => {}, quandEtat = () => {}) {
  const C = fenetre.AudioContext || fenetre.webkitAudioContext;
  if (!C) return { regler() {}, arreter() {} };
  let ctx = null; let gain = null; let source = null; let charge = null;
  let voulu = { active: false, volume: 0 };
  let arrete = false;

  const cible = () => (voulu.active ? gainDuVolume(voulu.volume) : 0);
  // UN FONDU, JAMAIS UNE COUPURE : allumer, éteindre ou tourner le curseur glisse
  // en une seconde environ. Une coupure sèche claque dans les enceintes du plateau.
  //
  // RIEN NE JETTE, ET C'EST GARDÉ ICI. Le lecteur tourne dans un effet React :
  // une exception y démonte TOUT le stream. Un moteur audio incomplet — une vieille
  // source navigateur, un contexte bridé — ne doit coûter que la musique : la
  // première version appelait `cancelScheduledValues` sans filet, et un contexte
  // qui ne l'avait pas éteignait l'écran de révélation entier.
  const appliquer = () => {
    if (!ctx || !gain) return;
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(cible(), ctx.currentTime, 0.35);
    } catch {
      try { gain.gain.value = cible(); } catch { /* le son se tait, l'écran continue */ }
    }
  };

  const reveil = () => {
    try { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch { /* idem */ }
  };
  const gestes = ['pointerdown', 'keydown'];

  const demarrer = () => {
    if (charge || arrete) return charge;
    try {
      ctx = new C();
      // L'ÉTAT DU SON, dit à l'écran : « suspended » tant que le navigateur retient
      // la musique faute de geste, « running » quand elle sort vraiment. C'est ce
      // qui permet de comprendre un stream muet sans ouvrir la console du navigateur.
      quandEtat(ctx.state);
      ctx.onstatechange = () => quandEtat(ctx.state);
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    } catch { ctx = null; gain = null; return null; }
    gestes.forEach((g) => fenetre.document.addEventListener(g, reveil, true));
    charge = Promise.resolve()
      .then(() => fenetre.fetch(FICHIER_MUSIQUE))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`musique ${r.status}`))))
      .then((octets) => new Promise((ok, ko) => ctx.decodeAudioData(octets, ok, ko)))
      .then((tampon) => {
        if (arrete) return;
        source = ctx.createBufferSource();
        source.buffer = tampon;
        source.loop = true;
        source.loopStart = MARGE_S;
        source.loopEnd = MARGE_S + BOUCLE_S;
        source.connect(gain);
        source.start(0, MARGE_S);
        reveil();
        appliquer();
        quandPrete();
      })
      .catch(() => {});
    return charge;
  };

  return {
    regler(etat) {
      voulu = { active: !!etat?.active, volume: Number(etat?.volume) || 0 };
      // Le fichier ne se charge qu'à la première demande de musique : un stream
      // dont l'animateur a coupé le son ne télécharge rien.
      if (voulu.active) demarrer();
      appliquer();
    },
    arreter() {
      arrete = true;
      gestes.forEach((g) => fenetre.document.removeEventListener(g, reveil, true));
      try { source?.stop(); } catch { /* déjà arrêtée */ }
      try { ctx?.close?.()?.catch?.(() => {}); } catch { /* déjà fermé */ }
    },
  };
}
