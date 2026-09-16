// LA LETTRE D'UN CHOIX — UNE SEULE DÉFINITION POUR LES TROIS SURFACES.
//
// CE QUI A ÉTÉ RAPPORTÉ (15/09) : « les choix sont numérotés par des lettres.
// Au-delà de 6 choix, on passe à une numérotation par chiffre. Il faut que ce
// soit uniquement des lettres. Dans l'exemple, les choix 7, 8 et 9 devraient être
// G, H et I. »
//
// LA CAUSE N'ÉTAIT PAS LE REPLI, C'ÉTAIT LA RECOPIE. La table `['A' … 'F']` était
// écrite TROIS FOIS — écran joueur, console animateur, toile du stream — et
// chacune portait son propre repli `|| i + 1`. Corriger une table en aurait laissé
// deux ; corriger les trois aurait laissé la quatrième surface à venir. C'est
// exactement le piège de la flamme, recopiée trois fois avant d'être rassemblée
// (voir `marque-flamme.js`).
//
// VINGT-SIX LETTRES, ET PAS DE REPLI. Le document en demande neuf ; on va jusqu'à
// Z parce qu'une règle qui s'arrête quelque part finit par être franchie sans
// qu'on s'en aperçoive — c'est ce qui vient de se produire à six. Au-delà de
// vingt-six choix, la question a un autre problème que sa numérotation : aucun
// écran de stream ne montre vingt-sept rangées lisibles, et le contrôle de
// `choix-visibles.spec.js` s'en chargerait bien avant.
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function lettreDeChoix(i) {
  // `typeof` AVANT `Number.isInteger`, et ce n'est pas du zèle : `Number(null)`
  // vaut ZÉRO, donc une absence rendait « A » — la première réponse, en toutes
  // lettres, à la place de rien. Pris par le contrôle avant d'atteindre un écran.
  if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= LETTRES.length) return '';
  return LETTRES[i];
}

export const NOMBRE_DE_LETTRES = LETTRES.length;
