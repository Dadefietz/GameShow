// LE BLANC ENTRE DEUX IMAGES D'UN DÉFILÉ.
//
// CE QU'IL CORRIGE. Les images d'une série se remplacent l'une l'autre sans
// interruption. Quand deux images IDENTIQUES se suivent — ce qui arrive dans
// « Retour de flamme », et qui est justement le moment où il faut buzzer —
// l'écran ne change pas : le joueur ne peut pas distinguer « la même image reste »
// de « la même image revient ». Le jeu devient injouable à l'endroit précis où il
// se joue.
//
// LA RÈGLE : un très court instant SANS IMAGE à chaque changement. Le vide ne se
// commente pas, il se remarque — et il rend la reprise visible même à l'identique.
//
// POURQUOI CÔTÉ CLIENT ET NON CÔTÉ SERVEUR. Un serveur qui pousserait un « vide »
// entre chaque image doublerait le nombre de messages d'une série, et le blanc
// arriverait décalé du réseau sur chaque téléphone — c'est-à-dire pas au même
// moment pour tout le monde. Ici il est calé sur la RÉCEPTION de l'image, donc
// toujours au bon endroit, quel que soit le retard de la liaison.
//
// ET IL SE CALE SUR LA PLACE, JAMAIS SUR L'IDENTIFIANT : deux images identiques
// portent le même identifiant, et se caler dessus ne verrait pas le changement —
// exactement le défaut qu'on corrige.
import { useEffect, useRef, useState } from 'react';

// Assez long pour se voir, assez court pour ne pas manger le temps d'observation
// sur une image qui n'en dure que deux mille millisecondes.
export const BLANC_MS = 130;

export function useBlancEntreImages(place, duree = BLANC_MS) {
  const [blanc, setBlanc] = useState(false);
  const precedente = useRef(place);
  useEffect(() => {
    // Rien au tout premier affichage : il n'y a pas d'image à distinguer de la
    // précédente, et un écran qui s'ouvre sur du vide ressemble à une panne.
    if (precedente.current === place || place == null) { precedente.current = place; return undefined; }
    precedente.current = place;
    setBlanc(true);
    const t = setTimeout(() => setBlanc(false), duree);
    return () => clearTimeout(t);
  }, [place, duree]);
  return blanc;
}
