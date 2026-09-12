// LA GRILLE 3×3 DE « CACHE-CACHE » — une seule, pour les trois surfaces.
//
// Elle sert à quatre moments qui n'ont pas la même taille ni le même contenu :
//   - le DÉVOILEMENT : les cases sont vides, une seule s'allume à la fois ;
//   - les QUESTIONS : les cases portent leur NUMÉRO, et rien d'autre ;
//   - les RÉPONSES : une case s'ouvre à chaque réponse dévoilée ;
//   - la FIN : les neuf objets, tous visibles.
//
// UN SEUL COMPOSANT POUR LES QUATRE, et pour les trois écrans. Le projet a déjà
// payé le prix de l'inverse — la flamme recopiée trois fois avant de diverger, les
// chaînons en deux rendus dont l'un est resté en arrière. Ce qui change d'un
// appel à l'autre tient en trois paramètres : ce qu'on montre, à quelle taille,
// et sous quel préfixe de classes.
import React, { useEffect, useState } from 'react';

// L'OBJET N'ARRIVE QU'UNE FOIS SON IMAGE CHARGÉE.
//
// CE QUI A ÉTÉ RAPPORTÉ : « lors de l'apparition de chacune des images, un fond
// blanc apparaît 1 demi-seconde avant que l'image apparaisse. Il faudrait que
// l'image et le fond blanc arrivent ensemble. »
//
// LA CAUSE : la case devient claire dès que le serveur annonce l'objet, mais le
// FICHIER de l'objet, lui, se télécharge ensuite. Entre les deux, la plaque est
// posée et vide — et sur ce jeu-là, une demi-seconde de trois est un huitième du
// temps de mémorisation, pris à tout le monde sauf à qui a la meilleure liaison.
//
// LA RÈGLE : on ne montre rien tant que l'image n'est pas décodée. Ce n'est pas un
// délai ajouté, c'est le délai qui existait déjà, déplacé du mauvais côté de la
// plaque. Le serveur commande toujours l'extinction : personne ne gagne de temps.
//
// POURQUOI PAS UN PRÉCHARGEMENT DE TOUTE LA GRILLE : neuf fichiers demandés au
// départ, ce sont neuf adresses lisibles dans l'inspecteur avant la première
// image. Le jeu de mémoire deviendrait un exercice de lecture de journal réseau.
export function useObjetPret(objet) {
  const [pret, setPret] = useState(null);
  const cle = objet ? `${objet.roundId}:${objet.place}:${objet.src}` : null;
  useEffect(() => {
    if (!objet || !objet.src) { setPret(null); return undefined; }
    let vivant = true;
    const img = new Image();
    img.onload = () => { if (vivant) setPret(objet); };
    // Une image qui n'arrive pas ne doit pas laisser la case éteinte pour
    // toujours : au pire on montre la plaque, comme avant.
    img.onerror = () => { if (vivant) setPret(objet); };
    img.src = objet.src;
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return pret;
}

export function GrilleCache({
  // `montre(place)` rend le contenu d'une case : un objet, un numéro, ou rien.
  montre,
  // Le préfixe BEM de la surface : `ccg` sur le téléphone, `st-ccg` à l'antenne.
  bloc = 'ccg',
  // LE MODIFICATEUR EST À PART, ET IL LE FAUT. Passé dans `bloc`, il partait
  // aussi dans le nom des cases : `bloc="ccg ccg--grande"` produisait des cases
  // en « ccg ccg--grande__case » — deux classes dont aucune n'existe. Les cases
  // héritaient alors de la grille elle-même, et la grille se réduisait à rien.
  // Vu à l'écran : neuf cases invisibles et un objet grand comme un timbre.
  modificateur = '',
  taille,
  testid,
  // La case mise en avant — celle qu'on vient de dévoiler.
  vive = null,
  etiquette = 'Grille de neuf cases',
}) {
  const style = taille ? { '--ccg-taille': `${taille}px` } : undefined;
  return (
    <div className={`${bloc}${modificateur ? ` ${modificateur}` : ''}`} style={style}
      data-testid={testid} role="img" aria-label={etiquette}>
      {Array.from({ length: 9 }, (_, i) => i + 1).map((place) => {
        const contenu = montre(place);
        return (
          <div key={place}
            className={`${bloc}__case${contenu ? ` ${bloc}__case--pleine` : ''}${vive === place ? ` ${bloc}__case--vive` : ''}`}
            data-place={place} data-pleine={contenu ? true : undefined}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
