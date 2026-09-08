// L'ADRESSE DE CONNEXION, DÉCOUPÉE EN SEGMENTS SÉCABLES.
//
// CE QUI SE PASSAIT. L'adresse s'affichait « localhost:8788/pl » puis « ay » sur
// la ligne suivante — coupée en plein mot, sur toutes les captures de stream.
//
// ET PAS SEULEMENT EN LOCAL. L'arithmétique qui a fixé `--pastille-st` à 390 px
// compte « show.onrender.com » (348 px) comme le plus long segment insécable de
// l'adresse d'hébergement. Ce calcul suppose qu'on peut passer à la ligne APRÈS
// la barre oblique. CSS n'offre pas cette coupure : pour un navigateur, le
// segment réel est « show.onrender.com/play », 450 px — plus large que la plaque.
// La plaque était donc dimensionnée sur une hypothèse que le navigateur ne tient
// pas, et `overflow-wrap: break-word` tranchait là où il pouvait, au milieu d'un
// mot.
//
// CE QUI CHANGE. On donne au navigateur les coupures que le calcul supposait : un
// `<wbr>` après chaque séparateur d'URL. Le repli tombe alors entre segments,
// jamais entre deux lettres.
//
// NI LA PLAQUE NI LA TYPO NE BOUGENT. Élargir la plaque ramènerait le panneau de
// 460 px qu'on venait justement de retirer ; rapetisser la typo ferait tomber
// l'adresse sous le plancher de 10 px sur un téléphone en paysage. Les deux sont
// chiffrés dans tokens.css. C'est l'hypothèse de coupure qui était fautive, pas
// les tailles.
//
// CE FICHIER EST À PART pour que le contrôle puisse mesurer la VRAIE adresse
// d'hébergement — celle qui compte — dans la vraie plaque, sans recopier la règle
// de découpage à côté. Un contrôle qui recopie la règle qu'il garde n'en garde
// rien.
export const SEPARATEURS = /(?<=[-.:/])/;

export function segmentsAdresse(adresse) {
  return String(adresse).split(SEPARATEURS);
}
