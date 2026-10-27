// LA VERSION DU CLIENT QUE CE SERVEUR SERT (26/10).
//
// « Quand nous étions 11 joueurs, je n'avais pas accès au bouton [Haut le cœur],
// je n'avais accès qu'à "Coup de cœur". » Le code de la console les affiche
// toujours tous les deux ; ce que l'animateur a vu, c'est la console D'AVANT,
// celle qui n'avait que le coup de cœur. Une page ouverte avant une mise en
// ligne garde son ancien code aussi longtemps qu'on ne la recharge pas — même
// quand le salon meurt avec le redémarrage et qu'on en ouvre un autre.
//
// Le nom du script principal porte l'empreinte du build (`index-C6zj9ng2.js`) :
// c'est la version. Le serveur la lit une fois dans son `index.html`, l'annonce à
// chaque connexion, et un écran qui ne tourne pas la même se sait périmé.
import fs from 'node:fs';
import path from 'node:path';

const MOTIF = /\/assets\/(index-[A-Za-z0-9_-]+\.js)/;

// `null` hors build (serveur de développement Vite) : rien à comparer.
export function versionDuBuild(html) {
  const m = MOTIF.exec(String(html || ''));
  return m ? m[1] : null;
}

export function lireVersionClient(distDir) {
  try {
    return versionDuBuild(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8'));
  } catch {
    return null;
  }
}
