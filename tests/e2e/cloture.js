// Clôture de salon entre deux tests E2E — À APPELER À LA FIN DE TOUT TEST QUI OUVRE UN SALON.
//
// Pourquoi c'est obligatoire : `POST /api/rooms` REDONNE à l'animateur son salon
// encore ouvert plutôt que d'en créer un neuf (src/server/index.js:80). Les tests
// partagent un serveur et la même identité d'animateur en mode dev — un test qui
// laisse son salon vivant lègue donc au suivant une partie déjà en cours, sur
// laquelle il n'y a ni salon d'attente ni compteur de joueurs. Le test suivant
// échoue alors pour une raison qui n'a rien à voir avec ce qu'il vérifie.
//
// Deux sorties possibles selon l'état où le test s'arrête :
//   - « Terminer la partie » met le salon en ENDED, que `getByOwner` traite comme
//     « plus de salon actif » (src/server/rooms.js:30) ;
//   - « Fermer le salon » le supprime, ce qui marche aussi depuis le salon
//     d'attente, où terminer n'est pas proposé.
// On tente les deux dans cet ordre.
//
// RÈGLE DE CE FICHIER : un nettoyage ne doit JAMAIS faire échouer un test. Tout
// est enveloppé — un salon qu'on n'a pas su fermer est un désagrément pour le
// test suivant, pas une raison de masquer le résultat de celui-ci.

async function tenter(hostPage, libelle) {
  const menu = hostPage.getByRole('button', { name: 'Menu' });
  if (!(await menu.count())) return false;
  await menu.click();

  const entree = hostPage.getByRole('menuitem', { name: libelle });
  if (!(await entree.count())) {
    await hostPage.keyboard.press('Escape'); // ne pas laisser le menu ouvert
    return false;
  }
  await entree.click();
  await hostPage.getByRole('menuitem', { name: `Confirmer — ${libelle.toLowerCase()}` }).click();
  return true;
}

export async function terminerPartie(hostPage) {
  try {
    await tenter(hostPage, 'Terminer la partie');
    await tenter(hostPage, 'Fermer le salon');
    await hostPage.keyboard.press('Escape');
  } catch {
    // Salon récalcitrant : on le signale au test suivant par son échec éventuel,
    // jamais en salissant le verdict de celui qui vient de se terminer.
  }
}
