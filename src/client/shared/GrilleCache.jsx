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
import React from 'react';

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
