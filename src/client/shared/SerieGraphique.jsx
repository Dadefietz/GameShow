// LE GRAPHIQUE D'UNE SÉRIE, À LA RÉVÉLATION.
//
// La série dans l'ordre où elle est passée, chaque numéro au-dessus, et le nombre
// de buzz sous chacune. Les images qui comptaient sont GROSSIES : c'est la seule
// chose que l'animateur doit voir en un coup d'œil pour commenter — où elles sont
// passées, et si le cercle les a vues.
//
// ---------------------------------------------------------------------------
// POURQUOI CE FICHIER EXISTE
// ---------------------------------------------------------------------------
// Ce graphique vivait en DEUX exemplaires : `GraphiqueVisages` sur la console et
// `SerieStream` à l'antenne, vingt lignes chacun, même structure, mêmes calculs,
// seuls les noms de classes et les tailles différaient. « Retour de flamme »
// demande exactement le même graphique sur les deux mêmes surfaces : sans ce
// fichier, le projet en aurait porté QUATRE.
//
// C'est le scénario que ce dépôt raconte à chaque emblème : la flamme recopiée
// trois fois avant de diverger, les chaînons en deux rendus dont l'un serait resté
// en arrière. On ne recommence pas.
//
// CE QUE CHAQUE SURFACE APPORTE, et rien de plus :
//   - `bloc` : son préfixe BEM (`vsgraf` sur la console, `st-serie` à l'antenne).
//     Les deux feuilles de style restent intactes, mot pour mot — c'est ce qui
//     garantit qu'aucun pixel des « Visages » ne bouge.
//   - `rendu(id, { grand, place, role })` : comment dessiner UNE image. Un portrait
//     pour l'un, un signe pour l'autre.
//   - `roleDe(place)` : ce qu'une place vaut dans ce jeu-là. Les visages ont deux
//     rôles distincts (la première apparition est une faute, la seconde une
//     réussite) ; « Retour de flamme » n'en a qu'un, répété six fois.
import React from 'react';

export function SerieGraphique({
  ordre, parPlace, roleDe, rendu, bloc, testid, colonnes,
}) {
  if (!Array.isArray(ordre) || !ordre.length) return null;
  const buzzDe = (i) => (Array.isArray(parPlace) ? parPlace[i] || 0 : 0);
  return (
    <div className={bloc} data-testid={testid}
      style={{ '--colonnes': colonnes || Math.ceil(ordre.length / 2) }}>
      {ordre.map((id, i) => {
        const place = i + 1;
        // `null` = une image ordinaire. Sinon : son nom (qui part dans `data-role`,
        // et que les contrôles de bout en bout interrogent), si elle est grossie,
        // et si c'est celle qui rapportait.
        const role = roleDe(place) || null;
        const grand = !!role?.grand;
        const buzz = buzzDe(i);
        return (
          <div key={place} data-place={place} data-role={role ? role.nom : 'figurant'}
            className={`${bloc}__col${grand ? ` ${bloc}__col--double` : ''}${role?.bonne ? ` ${bloc}__col--bonne` : ''}`}>
            <span className={`${bloc}__num`}>{place}</span>
            {rendu(id, { grand, place, role })}
            <span className={`${bloc}__buzz${buzz ? '' : ` ${bloc}__buzz--vide`}`}>{buzz}</span>
          </div>
        );
      })}
    </div>
  );
}
