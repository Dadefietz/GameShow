// LE GRAPHIQUE DE « CUEILLETTE » — VINGT TRANCHES DE CINQ POUR CENT.
//
// CE QUI A ÉTÉ DEMANDÉ (16/09) : « un graphique de répartition des joueurs par
// pourcentage de ressemblance. Le graphique va de 0 % à 100 % et les résultats
// sont répartis par tranche de 5 %, IL DOIT DONC Y AVOIR 20 TRANCHES », avec « le
// nombre de personnes par tranche ». Le même graphique paraît sur la console de
// l'animateur ET sur le stream — « la même chose que l'animateur ».
//
// ---------------------------------------------------------------------------
// POURQUOI UN FICHIER PARTAGÉ, ET NON DEUX COMPOSANTS
// ---------------------------------------------------------------------------
// Le même graphique sur deux surfaces s'est déjà écrit deux fois dans ce dépôt —
// `GraphiqueVisages` et `SerieStream`, vingt lignes chacun, même structure, mêmes
// calculs. `SerieGraphique` existe précisément pour avoir arrêté cela. Ici
// l'énoncé demande LITTÉRALEMENT « le même graphique » : l'écrire deux fois
// serait programmer la divergence.
//
// CE QUE CHAQUE SURFACE APPORTE : son préfixe BEM (`cuhist` sur la console,
// `st-cuhist` à l'antenne) et rien d'autre. Les deux feuilles de style restent
// libres de leurs tailles.
//
// ---------------------------------------------------------------------------
// LES TRANCHES VIENNENT DU SERVEUR, ENTIÈRES
// ---------------------------------------------------------------------------
// Vingt tranches, y compris les vides. Les recalculer ici à partir des scores
// ferait une seconde définition du découpage, à côté de celle du barème — et
// c'est exactement le défaut qui a été corrigé sur l'histogramme de l'Estimation,
// où les valeurs de bord tombaient d'un seul côté.
//
// UNE TRANCHE VIDE RESTE VISIBLE, en creux : « un espace vide correspond à une
// tranche dans laquelle aucun joueur n'a répondu » — c'est une information, pas
// un trou à refermer.
import React from 'react';

export function HistogrammeCueillette({ tranches, bloc = 'cuhist', testid = 'cuhist' }) {
  if (!Array.isArray(tranches) || !tranches.length) return null;
  const total = tranches.reduce((s, t) => s + (t.count || 0), 0);
  // LA HAUTEUR SE RAPPORTE À LA TRANCHE LA PLUS PEUPLÉE, pas au total. Rapportées
  // au total, dix tranches à un joueur chacune feraient dix barres à un dixième de
  // la hauteur — un graphique plat, qui ne dit plus rien de la dispersion.
  const max = Math.max(1, ...tranches.map((t) => t.count || 0));
  return (
    <div className={bloc} data-testid={testid}>
      <div className={`${bloc}__barres`}>
        {tranches.map((t) => {
          const n = t.count || 0;
          return (
            <div className={`${bloc}__col`} key={t.bas} data-count={n}
              title={`${n} joueur${n > 1 ? 's' : ''} — de ${t.bas} % à ${t.haut} % de ressemblance`}>
              <span className={`${bloc}__n`}>{n || ''}</span>
              <span className={`${bloc}__barre${n ? '' : ` ${bloc}__barre--vide`}`}
                style={{ '--part': n ? n / max : 0 }} />
            </div>
          );
        })}
      </div>
      {/* L'AXE NE PORTE QUE CINQ REPÈRES. Vingt étiquettes de « 0-5 » à « 95-100 »
          se chevauchent à la largeur d'une console, et se lisent encore moins bien
          sur un stream vu de loin. Les cinq quarts suffisent à situer une barre :
          c'est la dispersion qu'on regarde, pas une valeur au pour cent près. */}
      <div className={`${bloc}__axe`} aria-hidden="true">
        {[0, 25, 50, 75, 100].map((p) => <span key={p} className={`${bloc}__grad`}>{p} %</span>)}
      </div>
      <p className={`${bloc}__legende`}>
        {total > 1
          ? <>Répartition des <strong>{total}</strong> dessins, par tranche de 5 % de ressemblance</>
          : total === 1 ? <>Un seul dessin</> : <>Aucun dessin</>}
      </p>
    </div>
  );
}
