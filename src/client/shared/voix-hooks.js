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
import { dire, momentDePlateau } from './voix.js';

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
export function usePhraseDeManche(momentId, cle, serie, places) {
  const [etat, setEtat] = useState({ repere: null, phrase: null });
  const servi = useRef(null);
  const repere = momentId ? `${cle}·${momentId}` : null;

  useEffect(() => {
    if (!repere) { servi.current = null; setEtat({ repere: null, phrase: null }); return; }
    // Le garde est dans une RÉFÉRENCE, pas dans l'état : le mode strict rejoue
    // les effets au montage, et un garde en état laisserait passer un second
    // tirage — donc consommerait deux phrases du vivier pour une manche.
    if (servi.current === repere) return;
    servi.current = repere;
    setEtat({ repere, phrase: dire(momentId, { serie, places }) });
  }, [repere, momentId, serie, places]);

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
