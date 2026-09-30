// E2E — LA MUSIQUE D'AMBIANCE, DE LA CONSOLE AU STREAM (30/09).
//
// « Un petit fond sonore en mode petite musique de camp. » Elle joue sur le
// stream ; l'animateur l'allume, la coupe et la dose depuis sa console.
//
// CE QUE CE CONTRÔLE GARDE, ET QU'AUCUN AUTRE NE VOIT. Le fichier, sa durée et la
// justesse de la guitare se vérifient sans navigateur (`musique.test.js`). Ce qui
// ne se voit QUE dans un navigateur, c'est la chaîne : le fichier est servi, le
// navigateur le DÉCODE, la boucle démarre — et le réglage de la console arrive
// jusqu'à elle, puis survit à un rechargement du stream. Chacun de ces maillons
// peut casser en silence : une musique qui ne joue pas ne se voit sur aucune
// capture d'écran.
import { test, expect } from '@playwright/test';
import { openHost } from './helpers.js';
import { terminerPartie } from './cloture.js';

test('la musique joue sur le stream, et la console la règle', async ({ browser }) => {
  const hote = await openHost(browser);
  const stream = await hote.ctx.newPage();
  const fichiers = [];
  stream.on('response', (r) => { if (r.url().includes('/audio/')) fichiers.push(r.status()); });
  const token = await hote.page.evaluate(() => JSON.parse(localStorage.getItem('host')).overlayToken);
  await stream.goto(`/overlay?token=${token}`);
  const scene = stream.getByTestId('stream-fit');

  // ALLUMÉE D'OFFICE, à mi-volume, et RÉELLEMENT DÉCODÉE : « prête » ne se pose
  // qu'une fois le fichier téléchargé, décodé et la boucle lancée.
  await expect(scene).toHaveAttribute('data-musique', 'joue');
  await expect(scene).toHaveAttribute('data-musique-volume', '50');
  await expect(scene, 'le fichier n’a pas été décodé : le stream serait muet').toHaveAttribute('data-musique-prete', 'oui', { timeout: 15_000 });
  expect(fichiers, 'le fichier de musique n’a pas été servi').toContain(200);

  // LA CONSOLE LA COUPE…
  await hote.page.getByTestId('commande-musique').getByRole('button', { name: 'Musique' }).click();
  await hote.page.getByTestId('musique-interrupteur').click();
  await expect(scene).toHaveAttribute('data-musique', 'coupee');
  await expect(hote.page.getByTestId('commande-musique').getByRole('button', { name: 'Musique coupée' })).toBeVisible();

  // …LA DOSE…
  await hote.page.getByTestId('musique-volume').fill('30');
  await expect(scene).toHaveAttribute('data-musique-volume', '30');

  // …ET LE STREAM RECHARGÉ RETROUVE LE RÉGLAGE, au lieu de repartir à fond.
  await stream.reload();
  await expect(stream.getByTestId('stream-fit')).toHaveAttribute('data-musique', 'coupee');
  await expect(stream.getByTestId('stream-fit')).toHaveAttribute('data-musique-volume', '30');

  // La rallumer : de nouveau prête.
  await hote.page.getByTestId('musique-interrupteur').click();
  await expect(stream.getByTestId('stream-fit')).toHaveAttribute('data-musique', 'joue');
  await expect(stream.getByTestId('stream-fit')).toHaveAttribute('data-musique-prete', 'oui', { timeout: 15_000 });

  await terminerPartie(hote.page);
  await hote.ctx.close();
});
