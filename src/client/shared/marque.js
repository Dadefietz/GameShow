// LE NOM DU JEU — un seul endroit (action 19 du PLAN-CHANTIER-v1).
//
// Le nom était écrit en dur à sept endroits dans le code et trois dans la page
// d'accueil. Le changer demandait une fouille, avec la garantie d'en oublier un.
// Il vit désormais ici, et nulle part ailleurs : le jour où le nom définitif sera
// choisi, il n'y aura qu'une ligne à écrire.
//
// CE QUI N'EST PAS ICI, ET POURQUOI. Trois identifiants techniques portent aussi
// un nom, et aucun n'est visible par les joueurs :
//   - le paquet npm (package.json) — invisible, il ne sert qu'à l'outillage ;
//   - le dépôt GitHub, qui s'appelle d'ailleurs déjà autrement depuis le début
//     sans que personne ne s'en soit aperçu, ce qui prouve son insignifiance ;
//   - le service de déploiement (render.yaml) — celui-là mérite attention, car
//     sur ce type d'hébergement il détermine souvent l'adresse par défaut du
//     site. Il se traitera AVEC le domaine, pas avant.
// Les renommer casserait des liens et le déploiement pour un bénéfice nul.
//
// Le nom du jeu apparaît aussi sur la PAGE D'ACCUEIL (index.html) — titre de
// l'onglet, carte de partage, écran de démarrage. Ces trois-là ne peuvent pas
// lire ce fichier : ils sont servis avant que le code ne s'exécute. Un contrôle
// automatique vérifie donc qu'ils restent cohérents avec cette valeur.

export const NOM_DU_JEU = 'Project Game Show';

// Nom provisoire, en attente du choix définitif (« Game Show », « Fire Game
// Show », « Le Feu de Camp » ont été évoqués). Tant qu'il est vrai, le contrôle
// de cohérence se contente de vérifier que tout le monde dit la même chose.
export const NOM_PROVISOIRE = true;
