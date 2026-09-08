// CE QUE LES DEUX JEUX D'ADRESSE ANNONCENT AU SERVEUR.
//
// « Le juste temps » et « Coupe ta bûche » sont les deux seuls jeux du projet où
// le CLIENT annonce l'instant de son geste et où l'arbitre se contente de le
// borner. C'est ce qui rend le jeu jouable sur un réseau lent : deux téléphones
// séparés par cinq cents millisecondes de liaison sont jugés à l'identique.
//
// MAIS L'ANNONCE DOIT ÊTRE CELLE DU GESTE, pas celle du dernier rendu. Les deux
// écrans annonçaient la valeur AFFICHÉE, qui a l'âge de la dernière image :
// jusqu'à 17 ms à 60 Hz, 8 ms à 120 Hz. Sur la bûche, où le curseur parcourt cent
// points par seconde, cela fait 1,7 point d'écart — et le palier le plus haut n'en
// vaut qu'un. Deux joueurs au même geste, deux résultats, selon leur écran.
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import { ecouleMaintenant } from '../../src/client/shared/temps.js';

function horlogeA(ms) {
  vi.spyOn(performance, 'now').mockReturnValue(ms);
}
afterEach(() => vi.restoreAllMocks());

describe("l'écoulé au moment du geste", () => {
  it('compte depuis la RÉCEPTION locale du départ, pas depuis une heure murale', () => {
    // Aucune horloge partagée n'entre dans le calcul : seulement `performance.now`,
    // qui est monotone. Un téléphone à l'heure fausse joue exactement comme un
    // autre.
    horlogeA(5_400);
    expect(ecouleMaintenant({ recuA: 5_000 })).toBe(400);
    horlogeA(6_000);
    expect(ecouleMaintenant({ recuA: 5_000 })).toBe(1_000);
  });

  it("ajoute ce qui s'était déjà écoulé au rejeu d'une reconnexion", () => {
    // Un joueur qui recharge en pleine manche reçoit `resteMs` amputé de ce qui
    // est passé. Sans ce report, son curseur repartirait du début et il
    // annoncerait un instant qui n'a pas eu lieu.
    horlogeA(1_200);
    const rejeu = { recuA: 1_000, durationMs: 11_200, resteMs: 8_000 };
    expect(ecouleMaintenant(rejeu)).toBe(3_400);
  });

  it('ne rend rien tant que le départ n\'a pas été reçu', () => {
    expect(ecouleMaintenant({})).toBeNull();
    expect(ecouleMaintenant(null)).toBeNull();
  });

  it('ne remonte jamais avant le départ', () => {
    horlogeA(900);
    expect(ecouleMaintenant({ recuA: 1_000 })).toBe(0);
  });

  it("LES DEUX BOUTONS N'ANNONCENT PAS LA VALEUR AFFICHÉE", () => {
    // LE DÉFAUT GARDÉ, ET IL NE SE VOIT NULLE PART. Les deux gestionnaires de clic
    // lisaient l'état de React — donc l'image précédente. Rien ne cassait, aucun
    // écran ne mentait : seuls les points étaient légèrement faux, et d'une
    // quantité qui dépendait de la cadence d'affichage du téléphone.
    const src = fs.readFileSync('src/client/play/PlayApp.jsx', 'utf8');
    const clics = [...src.matchAll(/onClick=\{[^}]*onAnswer\(([^;]*?)\)\)?\}/gs)].map((m) => m[1]);
    for (const c of clics) {
      const suspect = /\becouleBuche\b|\bchronoSec\b/.test(c) && !c.includes('ecouleMaintenant');
      expect(suspect, `un bouton annonce la valeur affichée : ${c.slice(0, 80)}`).toBe(false);
    }
    // Et les deux jeux d'adresse relisent bien l'horloge au moment du geste.
    expect((src.match(/ecouleMaintenant\(current\)/g) || []).length,
      "un des deux jeux d'adresse ne relit pas l'horloge à l'instant du clic").toBeGreaterThanOrEqual(2);
  });
});
