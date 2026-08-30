// LES SEULS APPELANTS LÉGITIMES DE LA VOIX (chantier v3, décision 2).
//
// POURQUOI CE FICHIER EXISTE. `dire()` a un effet de bord : elle inscrit la
// phrase servie au registre des déjà-dites, pour ne pas la répéter. Appelée
// pendant un rendu, elle tire donc une phrase NEUVE à chaque re-rendu — et sur
// l'écran de résultat, où l'animation du score provoque une cinquantaine de
// re-rendus en 900 ms, le joueur voyait défiler la liste entière au lieu d'en
// lire une. La règle « pas de répétition dans une même partie » était morte avec.
//
// LE GARDE-FOU. Un contrôle bloquant vérifie qu'AUCUN autre fichier n'importe
// `dire`. La faute devient alors impossible par construction plutôt
// qu'improbable : un composant ne peut plus appeler la voix du tout, il ne peut
// qu'employer l'un des crochets ci-dessous, tous corrects par nature.
//
// Une première version du garde-fou balayait les sources à la recherche d'appels
// hors état/effet/mémo. Elle a été abandonnée : reconnaître une chaîne de
// caractères dans du JSX sans vraiment l'analyser est illusoire — une apostrophe
// dans « n'a » suffisait à lui faire perdre le fil et à laisser passer la faute
// même qu'elle prétendait attraper.
import { useEffect, useRef, useState } from 'react';
import { dire, momentDePlateau, MOMENTS } from './voix.js';

// ÉCRAN LONG — une phrase qui tourne. L'attente dure ; une ligne fixe y devient
// un décor qu'on ne lit plus.
//
// Le TITRE, lui, ne bouge pas : c'est lui qui donne son nom accessible à la page.
// La ligne rotative est retirée des annonces vocales — sinon un lecteur d'écran
// réciterait une phrase nouvelle toutes les six secondes par-dessus le reste.
export function usePhraseQuiTourne(momentId, intervalle = 6000) {
  const [phrase, setPhrase] = useState(() => dire(momentId));
  useEffect(() => {
    setPhrase(dire(momentId));
    const t = setInterval(() => setPhrase(dire(momentId)), intervalle);
    return () => clearInterval(t);
  }, [momentId, intervalle]);
  return phrase;
}

// ÉCRAN COURT — une phrase par manche, et une seule. Pas de rotation : la
// décision 4 de l'action 7 du chantier v1 impose une phrase FIXE sur les écrans
// de résultat, qu'on lit une fois.
//
// Le repère est l'identifiant de manche. Le figer sur le MOMENT
// (`juste.simple`, `juste.serie`…) ferait dire la même chose à deux manches
// consécutives de même résultat.
// LES VALEURS ARRIVENT EN UN SEUL OBJET (A30). Elles voyageaient en paramètres
// POSITIONNELS — `(momentId, cle, serie, places, taille)` —, et c'est ce qui a
// tué `{rang}` : le registre déclarait `requiert: ['rang']` depuis l'origine, le
// crochet n'avait tout simplement pas ce paramètre, et l'appelant de l'écran de
// fin passait deux arguments sur cinq. Personne ne pouvait le voir. Un objet
// nommé rend l'oubli visible à la lecture, et le contrôle du registre le rend
// impossible en silence.
//
// SI UNE VALEUR MANQUE ENCORE, LA PHRASE ATTEND. Le garde « une phrase par
// manche » figeait le premier tirage : une valeur arrivée en retard gelait le
// repère brut pour la manche entière. On ne sert donc qu'une fois toutes les
// valeurs déclarées présentes — et l'écran reste muet d'ici là, comme il l'est
// déjà avant que l'effet ait tourné. Jamais une phrase qui change sous les yeux
// du joueur.
export function usePhraseDeManche(momentId, cle, valeurs = {}) {
  const [etat, setEtat] = useState({ repere: null, phrase: null });
  const servi = useRef(null);
  const repere = momentId ? `${cle}·${momentId}` : null;
  // Empreinte STABLE des valeurs : l'objet est reconstruit à chaque rendu, sa
  // seule identité relancerait l'effet en boucle.
  const empreinte = JSON.stringify(valeurs ?? {});

  useEffect(() => {
    if (!repere) { servi.current = null; setEtat({ repere: null, phrase: null }); return; }
    const v = JSON.parse(empreinte);
    const requis = MOMENTS[momentId]?.requiert || [];
    if (requis.some((k) => v[k] == null)) return; // on attend : rien n'est encore servi
    // Le garde est dans une RÉFÉRENCE, pas dans l'état : le mode strict rejoue
    // les effets au montage, et un garde en état laisserait passer un second
    // tirage — donc consommerait deux phrases du vivier pour une manche.
    if (servi.current === repere) return;
    servi.current = repere;
    setEtat({ repere, phrase: dire(momentId, v) });
  }, [repere, momentId, empreinte]);

  // Tant que l'effet n'a pas tourné, on n'affiche RIEN plutôt que la phrase de la
  // manche précédente : une phrase périmée, même une image durant, dirait quelque
  // chose de faux sur le résultat affiché à côté.
  return etat.repere === repere ? etat.phrase : null;
}

// VOIX DE PLATEAU — le stream, qui se tait la plupart du temps.
//
// Commenter la répartition est le métier de l'animateur. Si l'écran le dit avant
// lui, il se retrouve à répéter ce que tout le monde a déjà lu. Le silence est
// donc une fonctionnalité : l'écran ne s'exprime que sur l'unanimité, l'échec
// collectif, le piège, l'égalité parfaite — et jamais deux manches d'affilée.
//
// Il parle du GROUPE, jamais d'un joueur nommé : le stream affiche les pseudos
// devant toute l'audience, et personne ne doit s'y faire chambrer par une machine.
export function useVoixDePlateau(reveal, stats, roundId) {
  const [dit, setDit] = useState(null);
  const dernierCommente = useRef(null);

  useEffect(() => {
    if (!reveal || !stats || roundId == null) { setDit(null); return; }
    if (dernierCommente.current != null && roundId === dernierCommente.current + 1) { setDit(null); return; }
    const moment = momentDePlateau(reveal.type, stats, reveal);
    if (!moment) { setDit(null); return; }
    dernierCommente.current = roundId;
    setDit(dire(moment));
  }, [reveal, stats, roundId]);

  return dit;
}
