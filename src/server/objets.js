// LA BANQUE D'OBJETS DE « CACHE-CACHE ».
//
// ============================================================================
// D'OÙ VIENNENT CES IMAGES
// ============================================================================
//
// 200 icônes FOURNIES PAR L'AUTEUR : quarante objets déclinés dans les cinq mêmes
// couleurs. Les droits et la licence relèvent de lui ; ce dépôt les sert, il ne
// les revendique pas. Voir docs/CREDITS.md.
//
// LE NOM ET LA COULEUR NE SONT PAS DÉCORATIFS, ils sont la matière du jeu : les
// questions portent sur eux (« quelle est la couleur du marteau ? », « quelle
// couleur n'est présente qu'une fois ? »), et les règles de tirage les
// contraignent. Ils étaient portés par le nom de fichier — « Marteau - Rouge.png ».
// Ils sont DÉCLARÉS ici, et le nom de fichier n'est plus qu'une adresse : un jeu
// qui lirait ses données dans un nom de fichier se casserait au premier renommage,
// et personne ne saurait pourquoi.
//
// TRAITEMENT : détourage du fond blanc, puis conversion en WebP (qualité 82,
// méthode 6 — le réglage de la banque de portraits, voir docs/CREDITS.md).
//
// LE DÉTOURAGE NE REND PAS « TOUT LE BLANC » TRANSPARENT, il part des BORDS et
// s'arrête aux traits. La distinction n'est pas un détail : le verre d'une
// ampoule, la vitre d'une voiture et les hublots d'un avion sont blancs eux
// aussi. Un détourage naïf les aurait troués, et l'objet serait apparu percé
// sur la plaque claire de sa case.

// LES CINQ COULEURS, dans l'ordre où elles s'affichent en choix de réponse.
// C'est le serveur qui les nomme : un écran qui les recopierait finirait par en
// proposer une que la banque ne contient pas.
export const COULEURS = ['Bleu', 'Jaune', 'Rose', 'Rouge', 'Vert'];

// Quarante noms, cinq couleurs, deux cents images — et une seule qui porte un
// couple donné. C'est ce que les règles de tirage exploitent : neuf noms
// distincts, chaque couleur une ou deux fois.
export const BASSIN_OBJETS = [
  { id: 'ampoule-bleu', nom: 'Ampoule', couleur: 'Bleu' },
  { id: 'ampoule-jaune', nom: 'Ampoule', couleur: 'Jaune' },
  { id: 'ampoule-rose', nom: 'Ampoule', couleur: 'Rose' },
  { id: 'ampoule-rouge', nom: 'Ampoule', couleur: 'Rouge' },
  { id: 'ampoule-vert', nom: 'Ampoule', couleur: 'Vert' },
  { id: 'arbre-bleu', nom: 'Arbre', couleur: 'Bleu' },
  { id: 'arbre-jaune', nom: 'Arbre', couleur: 'Jaune' },
  { id: 'arbre-rose', nom: 'Arbre', couleur: 'Rose' },
  { id: 'arbre-rouge', nom: 'Arbre', couleur: 'Rouge' },
  { id: 'arbre-vert', nom: 'Arbre', couleur: 'Vert' },
  { id: 'avion-bleu', nom: 'Avion', couleur: 'Bleu' },
  { id: 'avion-jaune', nom: 'Avion', couleur: 'Jaune' },
  { id: 'avion-rose', nom: 'Avion', couleur: 'Rose' },
  { id: 'avion-rouge', nom: 'Avion', couleur: 'Rouge' },
  { id: 'avion-vert', nom: 'Avion', couleur: 'Vert' },
  { id: 'ballon-bleu', nom: 'Ballon', couleur: 'Bleu' },
  { id: 'ballon-jaune', nom: 'Ballon', couleur: 'Jaune' },
  { id: 'ballon-rose', nom: 'Ballon', couleur: 'Rose' },
  { id: 'ballon-rouge', nom: 'Ballon', couleur: 'Rouge' },
  { id: 'ballon-vert', nom: 'Ballon', couleur: 'Vert' },
  { id: 'banane-bleu', nom: 'Banane', couleur: 'Bleu' },
  { id: 'banane-jaune', nom: 'Banane', couleur: 'Jaune' },
  { id: 'banane-rose', nom: 'Banane', couleur: 'Rose' },
  { id: 'banane-rouge', nom: 'Banane', couleur: 'Rouge' },
  { id: 'banane-vert', nom: 'Banane', couleur: 'Vert' },
  { id: 'bateau-bleu', nom: 'Bateau', couleur: 'Bleu' },
  { id: 'bateau-jaune', nom: 'Bateau', couleur: 'Jaune' },
  { id: 'bateau-rose', nom: 'Bateau', couleur: 'Rose' },
  { id: 'bateau-rouge', nom: 'Bateau', couleur: 'Rouge' },
  { id: 'bateau-vert', nom: 'Bateau', couleur: 'Vert' },
  { id: 'bougie-bleu', nom: 'Bougie', couleur: 'Bleu' },
  { id: 'bougie-jaune', nom: 'Bougie', couleur: 'Jaune' },
  { id: 'bougie-rose', nom: 'Bougie', couleur: 'Rose' },
  { id: 'bougie-rouge', nom: 'Bougie', couleur: 'Rouge' },
  { id: 'bougie-vert', nom: 'Bougie', couleur: 'Vert' },
  { id: 'cactus-bleu', nom: 'Cactus', couleur: 'Bleu' },
  { id: 'cactus-jaune', nom: 'Cactus', couleur: 'Jaune' },
  { id: 'cactus-rose', nom: 'Cactus', couleur: 'Rose' },
  { id: 'cactus-rouge', nom: 'Cactus', couleur: 'Rouge' },
  { id: 'cactus-vert', nom: 'Cactus', couleur: 'Vert' },
  { id: 'cafe-bleu', nom: 'Café', couleur: 'Bleu' },
  { id: 'cafe-jaune', nom: 'Café', couleur: 'Jaune' },
  { id: 'cafe-rose', nom: 'Café', couleur: 'Rose' },
  { id: 'cafe-rouge', nom: 'Café', couleur: 'Rouge' },
  { id: 'cafe-vert', nom: 'Café', couleur: 'Vert' },
  { id: 'chaise-bleu', nom: 'Chaise', couleur: 'Bleu' },
  { id: 'chaise-jaune', nom: 'Chaise', couleur: 'Jaune' },
  { id: 'chaise-rose', nom: 'Chaise', couleur: 'Rose' },
  { id: 'chaise-rouge', nom: 'Chaise', couleur: 'Rouge' },
  { id: 'chaise-vert', nom: 'Chaise', couleur: 'Vert' },
  { id: 'ciseaux-bleu', nom: 'Ciseaux', couleur: 'Bleu' },
  { id: 'ciseaux-jaune', nom: 'Ciseaux', couleur: 'Jaune' },
  { id: 'ciseaux-rose', nom: 'Ciseaux', couleur: 'Rose' },
  { id: 'ciseaux-rouge', nom: 'Ciseaux', couleur: 'Rouge' },
  { id: 'ciseaux-vert', nom: 'Ciseaux', couleur: 'Vert' },
  { id: 'cloche-bleu', nom: 'Cloche', couleur: 'Bleu' },
  { id: 'cloche-jaune', nom: 'Cloche', couleur: 'Jaune' },
  { id: 'cloche-rose', nom: 'Cloche', couleur: 'Rose' },
  { id: 'cloche-rouge', nom: 'Cloche', couleur: 'Rouge' },
  { id: 'cloche-vert', nom: 'Cloche', couleur: 'Vert' },
  { id: 'cle-a-molette-bleu', nom: 'Clé à molette', couleur: 'Bleu' },
  { id: 'cle-a-molette-jaune', nom: 'Clé à molette', couleur: 'Jaune' },
  { id: 'cle-a-molette-rose', nom: 'Clé à molette', couleur: 'Rose' },
  { id: 'cle-a-molette-rouge', nom: 'Clé à molette', couleur: 'Rouge' },
  { id: 'cle-a-molette-vert', nom: 'Clé à molette', couleur: 'Vert' },
  { id: 'couteau-bleu', nom: 'Couteau', couleur: 'Bleu' },
  { id: 'couteau-jaune', nom: 'Couteau', couleur: 'Jaune' },
  { id: 'couteau-rose', nom: 'Couteau', couleur: 'Rose' },
  { id: 'couteau-rouge', nom: 'Couteau', couleur: 'Rouge' },
  { id: 'couteau-vert', nom: 'Couteau', couleur: 'Vert' },
  { id: 'enveloppe-bleu', nom: 'Enveloppe', couleur: 'Bleu' },
  { id: 'enveloppe-jaune', nom: 'Enveloppe', couleur: 'Jaune' },
  { id: 'enveloppe-rose', nom: 'Enveloppe', couleur: 'Rose' },
  { id: 'enveloppe-rouge', nom: 'Enveloppe', couleur: 'Rouge' },
  { id: 'enveloppe-vert', nom: 'Enveloppe', couleur: 'Vert' },
  { id: 'etoile-bleu', nom: 'Etoile', couleur: 'Bleu' },
  { id: 'etoile-jaune', nom: 'Etoile', couleur: 'Jaune' },
  { id: 'etoile-rose', nom: 'Etoile', couleur: 'Rose' },
  { id: 'etoile-rouge', nom: 'Etoile', couleur: 'Rouge' },
  { id: 'etoile-vert', nom: 'Etoile', couleur: 'Vert' },
  { id: 'fleur-bleu', nom: 'Fleur', couleur: 'Bleu' },
  { id: 'fleur-jaune', nom: 'Fleur', couleur: 'Jaune' },
  { id: 'fleur-rose', nom: 'Fleur', couleur: 'Rose' },
  { id: 'fleur-rouge', nom: 'Fleur', couleur: 'Rouge' },
  { id: 'fleur-vert', nom: 'Fleur', couleur: 'Vert' },
  { id: 'fourchette-bleu', nom: 'Fourchette', couleur: 'Bleu' },
  { id: 'fourchette-jaune', nom: 'Fourchette', couleur: 'Jaune' },
  { id: 'fourchette-rose', nom: 'Fourchette', couleur: 'Rose' },
  { id: 'fourchette-rouge', nom: 'Fourchette', couleur: 'Rouge' },
  { id: 'fourchette-vert', nom: 'Fourchette', couleur: 'Vert' },
  { id: 'guitare-bleu', nom: 'Guitare', couleur: 'Bleu' },
  { id: 'guitare-jaune', nom: 'Guitare', couleur: 'Jaune' },
  { id: 'guitare-rose', nom: 'Guitare', couleur: 'Rose' },
  { id: 'guitare-rouge', nom: 'Guitare', couleur: 'Rouge' },
  { id: 'guitare-vert', nom: 'Guitare', couleur: 'Vert' },
  { id: 'lune-bleu', nom: 'Lune', couleur: 'Bleu' },
  { id: 'lune-jaune', nom: 'Lune', couleur: 'Jaune' },
  { id: 'lune-rose', nom: 'Lune', couleur: 'Rose' },
  { id: 'lune-rouge', nom: 'Lune', couleur: 'Rouge' },
  { id: 'lune-vert', nom: 'Lune', couleur: 'Vert' },
  { id: 'main-bleu', nom: 'Main', couleur: 'Bleu' },
  { id: 'main-jaune', nom: 'Main', couleur: 'Jaune' },
  { id: 'main-rose', nom: 'Main', couleur: 'Rose' },
  { id: 'main-rouge', nom: 'Main', couleur: 'Rouge' },
  { id: 'main-vert', nom: 'Main', couleur: 'Vert' },
  { id: 'maison-bleu', nom: 'Maison', couleur: 'Bleu' },
  { id: 'maison-jaune', nom: 'Maison', couleur: 'Jaune' },
  { id: 'maison-rose', nom: 'Maison', couleur: 'Rose' },
  { id: 'maison-rouge', nom: 'Maison', couleur: 'Rouge' },
  { id: 'maison-vert', nom: 'Maison', couleur: 'Vert' },
  { id: 'marteau-bleu', nom: 'Marteau', couleur: 'Bleu' },
  { id: 'marteau-jaune', nom: 'Marteau', couleur: 'Jaune' },
  { id: 'marteau-rose', nom: 'Marteau', couleur: 'Rose' },
  { id: 'marteau-rouge', nom: 'Marteau', couleur: 'Rouge' },
  { id: 'marteau-vert', nom: 'Marteau', couleur: 'Vert' },
  { id: 'os-bleu', nom: 'Os', couleur: 'Bleu' },
  { id: 'os-jaune', nom: 'Os', couleur: 'Jaune' },
  { id: 'os-rose', nom: 'Os', couleur: 'Rose' },
  { id: 'os-rouge', nom: 'Os', couleur: 'Rouge' },
  { id: 'os-vert', nom: 'Os', couleur: 'Vert' },
  { id: 'parapluie-bleu', nom: 'Parapluie', couleur: 'Bleu' },
  { id: 'parapluie-jaune', nom: 'Parapluie', couleur: 'Jaune' },
  { id: 'parapluie-rose', nom: 'Parapluie', couleur: 'Rose' },
  { id: 'parapluie-rouge', nom: 'Parapluie', couleur: 'Rouge' },
  { id: 'parapluie-vert', nom: 'Parapluie', couleur: 'Vert' },
  { id: 'plume-bleu', nom: 'Plume', couleur: 'Bleu' },
  { id: 'plume-jaune', nom: 'Plume', couleur: 'Jaune' },
  { id: 'plume-rose', nom: 'Plume', couleur: 'Rose' },
  { id: 'plume-rouge', nom: 'Plume', couleur: 'Rouge' },
  { id: 'plume-vert', nom: 'Plume', couleur: 'Vert' },
  { id: 'poisson-bleu', nom: 'Poisson', couleur: 'Bleu' },
  { id: 'poisson-jaune', nom: 'Poisson', couleur: 'Jaune' },
  { id: 'poisson-rose', nom: 'Poisson', couleur: 'Rose' },
  { id: 'poisson-rouge', nom: 'Poisson', couleur: 'Rouge' },
  { id: 'poisson-vert', nom: 'Poisson', couleur: 'Vert' },
  { id: 'pomme-bleu', nom: 'Pomme', couleur: 'Bleu' },
  { id: 'pomme-jaune', nom: 'Pomme', couleur: 'Jaune' },
  { id: 'pomme-rose', nom: 'Pomme', couleur: 'Rose' },
  { id: 'pomme-rouge', nom: 'Pomme', couleur: 'Rouge' },
  { id: 'pomme-vert', nom: 'Pomme', couleur: 'Vert' },
  { id: 'poubelle-bleu', nom: 'Poubelle', couleur: 'Bleu' },
  { id: 'poubelle-jaune', nom: 'Poubelle', couleur: 'Jaune' },
  { id: 'poubelle-rose', nom: 'Poubelle', couleur: 'Rose' },
  { id: 'poubelle-rouge', nom: 'Poubelle', couleur: 'Rouge' },
  { id: 'poubelle-vert', nom: 'Poubelle', couleur: 'Vert' },
  { id: 'pyramide-bleu', nom: 'Pyramide', couleur: 'Bleu' },
  { id: 'pyramide-jaune', nom: 'Pyramide', couleur: 'Jaune' },
  { id: 'pyramide-rose', nom: 'Pyramide', couleur: 'Rose' },
  { id: 'pyramide-rouge', nom: 'Pyramide', couleur: 'Rouge' },
  { id: 'pyramide-vert', nom: 'Pyramide', couleur: 'Vert' },
  { id: 'robe-bleu', nom: 'Robe', couleur: 'Bleu' },
  { id: 'robe-jaune', nom: 'Robe', couleur: 'Jaune' },
  { id: 'robe-rose', nom: 'Robe', couleur: 'Rose' },
  { id: 'robe-rouge', nom: 'Robe', couleur: 'Rouge' },
  { id: 'robe-vert', nom: 'Robe', couleur: 'Vert' },
  { id: 'soleil-bleu', nom: 'Soleil', couleur: 'Bleu' },
  { id: 'soleil-jaune', nom: 'Soleil', couleur: 'Jaune' },
  { id: 'soleil-rose', nom: 'Soleil', couleur: 'Rose' },
  { id: 'soleil-rouge', nom: 'Soleil', couleur: 'Rouge' },
  { id: 'soleil-vert', nom: 'Soleil', couleur: 'Vert' },
  { id: 't-shirt-bleu', nom: 'T-shirt', couleur: 'Bleu' },
  { id: 't-shirt-jaune', nom: 'T-shirt', couleur: 'Jaune' },
  { id: 't-shirt-rose', nom: 'T-shirt', couleur: 'Rose' },
  { id: 't-shirt-rouge', nom: 'T-shirt', couleur: 'Rouge' },
  { id: 't-shirt-vert', nom: 'T-shirt', couleur: 'Vert' },
  { id: 'table-bleu', nom: 'Table', couleur: 'Bleu' },
  { id: 'table-jaune', nom: 'Table', couleur: 'Jaune' },
  { id: 'table-rose', nom: 'Table', couleur: 'Rose' },
  { id: 'table-rouge', nom: 'Table', couleur: 'Rouge' },
  { id: 'table-vert', nom: 'Table', couleur: 'Vert' },
  { id: 'tambour-bleu', nom: 'Tambour', couleur: 'Bleu' },
  { id: 'tambour-jaune', nom: 'Tambour', couleur: 'Jaune' },
  { id: 'tambour-rose', nom: 'Tambour', couleur: 'Rose' },
  { id: 'tambour-rouge', nom: 'Tambour', couleur: 'Rouge' },
  { id: 'tambour-vert', nom: 'Tambour', couleur: 'Vert' },
  { id: 'train-bleu', nom: 'Train', couleur: 'Bleu' },
  { id: 'train-jaune', nom: 'Train', couleur: 'Jaune' },
  { id: 'train-rose', nom: 'Train', couleur: 'Rose' },
  { id: 'train-rouge', nom: 'Train', couleur: 'Rouge' },
  { id: 'train-vert', nom: 'Train', couleur: 'Vert' },
  { id: 'telephone-bleu', nom: 'Téléphone', couleur: 'Bleu' },
  { id: 'telephone-jaune', nom: 'Téléphone', couleur: 'Jaune' },
  { id: 'telephone-rose', nom: 'Téléphone', couleur: 'Rose' },
  { id: 'telephone-rouge', nom: 'Téléphone', couleur: 'Rouge' },
  { id: 'telephone-vert', nom: 'Téléphone', couleur: 'Vert' },
  { id: 'television-bleu', nom: 'Télévision', couleur: 'Bleu' },
  { id: 'television-jaune', nom: 'Télévision', couleur: 'Jaune' },
  { id: 'television-rose', nom: 'Télévision', couleur: 'Rose' },
  { id: 'television-rouge', nom: 'Télévision', couleur: 'Rouge' },
  { id: 'television-vert', nom: 'Télévision', couleur: 'Vert' },
  { id: 'voiture-bleu', nom: 'Voiture', couleur: 'Bleu' },
  { id: 'voiture-jaune', nom: 'Voiture', couleur: 'Jaune' },
  { id: 'voiture-rose', nom: 'Voiture', couleur: 'Rose' },
  { id: 'voiture-rouge', nom: 'Voiture', couleur: 'Rouge' },
  { id: 'voiture-vert', nom: 'Voiture', couleur: 'Vert' },
  { id: 'velo-bleu', nom: 'Vélo', couleur: 'Bleu' },
  { id: 'velo-jaune', nom: 'Vélo', couleur: 'Jaune' },
  { id: 'velo-rose', nom: 'Vélo', couleur: 'Rose' },
  { id: 'velo-rouge', nom: 'Vélo', couleur: 'Rouge' },
  { id: 'velo-vert', nom: 'Vélo', couleur: 'Vert' },
];

export function idsDuBassin() {
  return BASSIN_OBJETS.map((o) => o.id);
}

// LES NOMS DISTINCTS — quarante. Le tirage en prend neuf.
export const NOMS_OBJETS = [...new Set(BASSIN_OBJETS.map((o) => o.nom))];

// L'ADRESSE D'UN OBJET, ET LE SEUL ENDROIT QUI LA CONNAISSE. Même règle que la
// banque de visages : le client ne déduit JAMAIS une adresse d'un identifiant,
// il reçoit l'une et l'autre du serveur.
const PAR_ID = new Map(BASSIN_OBJETS.map((o) => [o.id, o]));
export function objetDe(id) {
  return PAR_ID.get(id) || null;
}
export function srcDObjet(id) {
  return PAR_ID.has(id) ? `/objets/${id}.webp` : null;
}
