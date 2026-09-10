// Hook temps réel partagé par toutes les surfaces. Se connecte avec un token de jeu,
// maintient l'état reçu du serveur (autoritaire), et expose une fonction d'émission.
import { useEffect, useRef, useState, useCallback } from 'react';
import { connectSocket } from './net.js';

export function useGame(token) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);        // { code, state, playerCount, progression, leaderboard }
  const [current, setCurrent] = useState(null);   // module en cours (question publique)
  const [tick, setTick] = useState(null);         // { timeLeft, answers }
  const [reveal, setReveal] = useState(null);     // résultat révélé
  const [leaderboard, setLeaderboard] = useState([]);
  const [you, setYou] = useState(null);           // { rank, score, delta } (joueur)
  const [podium, setPodium] = useState(null);
  const [answered, setAnswered] = useState(false);
  // COMBIEN DE FOIS LE JOUEUR A BUZZÉ dans la manche en cours. Un seul jeu s'en
  // sert — « Retour de flamme », où l'on buzze six fois si l'on est bon. Partout
  // ailleurs il vaut 0 ou 1, et c'est `answered` qui commande.
  const [buzz, setBuzz] = useState(0);
  const [monChoix, setMonChoix] = useState(null);
  const [presentAuLancement, setPresentAuLancement] = useState(true);
  // L'ANNONCE d'un jeu qui n'a pas encore démarré — « Le lien » se joue en deux
  // temps : le cercle voit le nom du jeu pendant que l'animateur saisit ses mots.
  const [annonce, setAnnonce] = useState(null);
  const [roomClosed, setRoomClosed] = useState(false);
  // LES JEUX DE DÉFILÉ — « Les visages », « Retour de flamme » : l'image à
  // l'écran, poussée une par une par le serveur.
  //
  // Elle ne vit PAS dans `current` : la série entière n'est jamais envoyée — un
  // identifiant qui y figurerait deux fois donnerait la réponse à qui ouvre
  // l'onglet réseau. Le serveur pousse, le client affiche, et personne ne sait
  // ce qui vient.
  //
  // UN SEUL ÉTAT POUR LES DEUX JEUX, comme il n'y a qu'un défilé côté serveur :
  // ils ne peuvent pas tourner en même temps, et deux états jumeaux auraient
  // divergé au premier correctif.
  const [element, setElement] = useState(null);    // { roundId, place, id, src }
  // « CACHE-CACHE » — l'objet actuellement allumé dans la grille, les réponses
  // déjà dévoilées, et le compte personnel du joueur. Trois états séparés parce
  // qu'ils vivent à trois moments différents de la même manche.
  const [objetCache, setObjetCache] = useState(null);   // { roundId, place, id, src }
  const [devoilements, setDevoilements] = useState([]); // [{ n, texte, reponse, place, objet }]
  const [monCompte, setMonCompte] = useState(null);     // { n, correct, base, speed, total }
  const [tourClos, setTourClos] = useState(false);
  const [distribution, setDistribution] = useState(null); // répartition des réponses (animateur)
  const [history, setHistory] = useState([]);             // récap des manches (fin de partie)
  const [fatal, setFatal] = useState(null);               // salon mort / token invalide (irrécupérable)
  const [serverError, setServerError] = useState(null);   // erreur signalée par le serveur (host:error)

  useEffect(() => {
    if (!token) return;
    setFatal(null);
    const s = connectSocket(token);
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    // Salon disparu (redéploiement serveur, expiration) ou token invalide :
    // inutile de réessayer — on le signale pour que la surface purge sa session
    // locale au lieu de rester figée sur des informations périmées.
    s.on('connect_error', (err) => {
      const msg = err && err.message;
      if (msg === 'room-not-found' || msg === 'unauthorized') {
        setFatal(msg);
        s.close();
      }
    });
    s.on('room:state', (st) => { setRoom(st); if (st.leaderboard) setLeaderboard(st.leaderboard); });
    s.on('module:started', (m) => {
      // L'INSTANT LOCAL DE LA RÉCEPTION, posé ici et nulle part ailleurs.
      //
      // « Le juste temps » se joue au centième : son compte à rebours ne peut pas
      // se déduire de la `deadline` du serveur, qui est un instant d'une AUTRE
      // horloge que celle du téléphone. Le serveur envoie donc une durée
      // (`resteMs`) et le client la décompte depuis cette marque, prise sur une
      // horloge monotone — voir `shared/temps.js`.
      //
      // C'est ici qu'elle se prend, au plus près de l'arrivée du message : tout
      // ce qui se passe ensuite (rendu, montage d'un écran) s'ajouterait au temps
      // mesuré, et se retrancherait du temps de jeu.
      const recuA = typeof performance !== 'undefined' ? performance.now() : Date.now();
      // `answered` restauré par le serveur (reconnexion/retardataire : pas de double réponse).
      // `answered` VEUT DIRE « A PARTICIPÉ », et rien d'autre.
      //
      // J'AVAIS CONFONDU DEUX CHOSES, et l'écran l'a dit tout de suite : « a
      // participé » et « l'écran est verrouillé » étaient le même drapeau, ce qui
      // marche tant qu'on ne répond qu'une fois. En le forçant à `false` pour
      // laisser le bouton vivant dans « Retour de flamme », j'ai fait dire à
      // l'écran de résultat « le temps t'a devancé » à un joueur qui venait de
      // buzzer quatre fois. Le verrouillage appartient à l'ÉCRAN DE JEU, qui sait
      // quel jeu il affiche ; la participation appartient au serveur.
      setCurrent({ ...m, recuA }); setReveal(null); setDistribution(null); setPodium(null);
      setAnswered(!!m.answered);
      // L'image de la manche PRÉCÉDENTE ne doit pas survivre au démarrage de la
      // suivante : elle resterait affichée jusqu'à la première image de la
      // nouvelle série, à l'écran, pendant deux secondes.
      setElement(null);
      // La grille de « Cache-cache » repart vide à chaque tour : un objet resté
      // allumé du tour précédent serait montré une seconde fois, gratuitement.
      setObjetCache(null);
      setTourClos(false);
      // Les réponses dévoilées n'appartiennent qu'à leur manche. Le tour 1 d'une
      // NOUVELLE manche les efface ; les tours suivants de la même manche non —
      // sans quoi la deuxième question effacerait la première.
      if (m.tour == null || m.tour <= 1) { setDevoilements([]); setMonCompte(null); }
      // Le choix du joueur, rejoué par le serveur à la reconnexion : sans lui,
      // l'écran de résultat ne peut pas conclure (voir src/server/index.js).
      setMonChoix(m.monChoix ?? null);
      // SEUL UN `false` EXPLICITE dit « arrivé après ». La diffusion au salon ne
      // porte pas ce champ — et n'atteint que ceux qui étaient déjà là.
      setPresentAuLancement(m.presentAuLancement !== false);
      setBuzz(Array.isArray(m.monChoix) ? m.monChoix.length : (m.answered ? 1 : 0));
      setAnnonce(null);
      // Temps restant RÉEL (deadline serveur) — un rechargement en cours de manche
      // n'affiche plus la durée totale comme s'il restait tout le temps.
      const left = m.deadline ? Math.max(0, Math.ceil((m.deadline - Date.now()) / 1000)) : Math.ceil((m.durationMs || 0) / 1000);
      setTick({ timeLeft: left, answers: 0 });
    });
    s.on('module:distribution', (d) => setDistribution(d));
    s.on('serie:element', (v) => setElement(v && v.id ? v : null));
    s.on('cache:objet', (v) => setObjetCache(v && v.place ? v : null));
    s.on('cache:devoilement', (d) => setDevoilements((prev) => (
      prev.some((x) => x.n === d.n) ? prev : [...prev, d].sort((a, b) => a.n - b.n)
    )));
    s.on('cache:tonpoint', (d) => setMonCompte(d));
    s.on('module:tourClos', () => setTourClos(true));
    s.on('host:error', (e) => setServerError({ ...e, at: Date.now() }));
    s.on('module:tick', (t) => setTick(t));
    s.on('module:answersCount', (c) => setTick((prev) => ({ ...(prev || {}), answers: c.count })));
    s.on('module:closed', () => setTick((prev) => ({ ...(prev || {}), timeLeft: 0 })));
    s.on('module:reveal', (r) => setReveal(r));
    s.on('module:annonce', (a) => { setAnnonce(a || null); setReveal(null); setCurrent(null); setYou(null); });
    s.on('leaderboard:update', (d) => setLeaderboard(d.leaderboard || []));
    s.on('play:you', (y) => setYou(y));
    // L'ACCUSÉ DE RÉCEPTION D'UN BUZZ.
    //
    // Le serveur renvoie le NOMBRE de buzz enregistrés quand le jeu en accepte
    // plusieurs. On le retient pour l'afficher ; c'est l'écran de jeu qui décide
    // s'il se verrouille, pas ce compteur.
    s.on('play:accepted', (res) => {
      if (!res) return;
      if (typeof res.buzz === 'number') setBuzz(res.buzz);
      if (res.ok || res.reason === 'already') setAnswered(true);
    });
    s.on('game:ended', (d) => { setPodium(d.podium || []); setLeaderboard(d.leaderboard || []); setHistory(d.history || []); });
    // Retour au salon d'attente : on efface tout le résiduel de la partie précédente,
    // sinon le joueur resterait sur son podium et l'animateur sur son classement.
    s.on('game:lobby', () => {
      setBuzz(0);
      // podium à null, pas à [] : la surface joueur teste sa simple présence
      // pour afficher l'écran de fin, et un tableau vide reste « vrai ».
      setPodium(null); setLeaderboard([]); setHistory([]);
      setReveal(null); setTick(null); setYou(null); setAnswered(false);
    });
    s.on('room:closed', () => setRoomClosed(true));
    return () => s.close();
  }, [token]);

  const emit = useCallback((event, payload, ack) => {
    socketRef.current?.emit(event, payload, ack);
  }, []);

  // Abonnement PONCTUEL à un événement, pour les données qui n'appartiennent
  // qu'à une surface — la file d'attente, par exemple, qui ne concerne que
  // l'animateur et n'a rien à faire dans l'état partagé de toutes les surfaces.
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
  }, []);
  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { connected, room, current, tick, reveal, leaderboard, you, podium, annonce, answered, monChoix, presentAuLancement, roomClosed, distribution, element, buzz, history, fatal, serverError, objetCache, devoilements, monCompte, tourClos, emit, on, off };
}

// Persistance légère (reconnexion sans perte).
export const store = {
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} },
  load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  clear(key) { try { localStorage.removeItem(key); } catch {} },
  // Clés stockées commençant par un préfixe. Sert au repli de la décision 1.2 du
  // chantier v4 : quand l'URL ne porte pas de code de salon, on ne peut retrouver
  // la session qu'en cherchant ce qui est là.
  cles(prefixe) {
    try { return Object.keys(localStorage).filter((k) => k.startsWith(prefixe)); } catch { return []; }
  },
};
