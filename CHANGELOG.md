# CHANGELOG

Journal humain des versions, **append-only** : on ajoute en haut, on ne réécrit
jamais une entrée passée. La trace machine correspondante vit dans
`docs/changes/` quand le change-set est piloté par l'orchestrateur ; le chantier
v1 ci-dessous a été mené à la main, son dossier de référence est
[`docs/PLAN-CHANTIER-v1.md`](docs/PLAN-CHANTIER-v1.md).

---

## v0.2.0 — 2026-08-20 — Chantier v1

Première version jouable de bout en bout par deux animateurs distincts.

**Demande d'origine.** Deux réunions : une revue de fonctionnalités, puis une
session de test approfondi à deux jours. 19 actions retenues, discutées une à une
et arrêtées avant écriture du code — 167 décisions au total, consignées dans le
plan de chantier.

### Ce qui change pour l'animateur

- **Un jeu porte un nom.** L'unité de jeu n'est plus un type (« quiz »,
  « estimation ») mais un jeu nommé, avec sa propre réserve de questions. Deux
  jeux du même type ne se mélangent plus — c'était le défaut de fond : le Studio
  et la partie rangeaient les questions dans quatre seaux communs, si bien que
  lancer « Culture générale » pouvait tirer une question de « Spécial cinéma ».
- **Le Studio alimente vraiment la partie.** Une question créée dans le Studio
  arrive dans le jeu, et réciproquement. Deux chemins d'écriture étaient rompus,
  dont un par un simple en-tête d'autorisation manquant.
- **Deux comptes animateur, deux bibliothèques**, cloisonnées sur disque : un
  fichier par compte, aucun écrasement mutuel quand les deux enregistrent en même
  temps. Les salons suivent le même cloisonnement.
- **File d'attente des questions**, visible au lancement et réordonnable par
  glisser-déposer, à la manière d'une file d'écoute. L'animateur peut en retirer
  une. Une file par jeu.
- **Aucune question posée deux fois** dans le même salon.
- **Bouton « restaurer les questions de base »** : les 20 questions d'exemple
  sont supprimables, et récupérables sans écraser le travail déjà fait.
- Le **menu « changer de module »** ne s'ouvre plus sous la ligne de flottaison.
- Le **panneau de correction manuelle des scores est supprimé**.

### Ce qui change pour le joueur

- **La voix du jeu** : 181 phrases contextuelles réparties sur 36 moments, pour
  qu'aucun écran ne reste muet — y compris pour qui attend seul, arrive après le
  lancement, ou attend son résultat. Une mauvaise réponse se dit sans humilier.
- **Relevé de fin de manche** : points de base, points complémentaires de
  vitesse, série de bonnes réponses, places gagnées ou perdues.
- **Barème énoncé** avant de jouer, pour les quatre jeux.
- **Aucun malus, nulle part.** Aucun jeu ne retire de points.
- Le bouton « quitter » est retiré.

### Ce qui change à l'écran de stream

- Disposition refondue : le **classement remplace la vue tronquée** dans le cadre
  du QR code, qui reste visible en petit avec le code de salon.
- **Histogrammes de répartition** sur les estimations, jauges de répartition sur
  les votes.
- Le stream **se tait sur une manche ordinaire** et ne nomme jamais personne.

### Règles de score revues

- Quiz et vrai/faux : 700 points de base, jusqu'à 300 points complémentaires de
  vitesse.
- **Estimation par paliers de précision** — au mille, proche, correct, loin — au
  lieu d'un calcul où la vitesse pesait plus lourd que la justesse.
- **Le vote devient un jeu** : la majorité marque, la minorité ne perd rien.
- La série de bonnes réponses est une **information**, pas un multiplicateur.

### Sécurité

- Connexion par mot de passe, adresse masquée à l'affichage, messages d'erreur
  qui ne révèlent pas l'existence d'un compte.
- Le schéma de base **F-006** a été récupéré depuis l'historique de migrations de
  la base elle-même — il avait été appliqué sans jamais être versionné — puis
  durci : `handle_new_user()` ne peut plus être appelée par un client.
- **Renoncement assumé** : la protection contre les mots de passe compromis
  demande un plan payant. Non activée, sciemment.

### Système de design

Les trois dernières valeurs `oklch()` écrites en dur dans le CSS client sont
devenues des jetons. Surtout, le contrôle que `AGENTS.md` annonçait depuis le
début — « le gate refuse mécaniquement toute valeur de design écrite hors de
tokens.css » — **n'existait pas**. Il existe désormais, et c'est ce qui explique
que ces trois valeurs aient survécu des mois sans être vues.

### Vérification

| | avant | après |
| --- | --- | --- |
| Tests unitaires | 66 | **89** |
| Tests de bout en bout | — | **45** |
| Boucle d'intégration | — | tous contrôles |

Chaque correctif a été vérifié **dans les deux sens** : le code défectueux a été
temporairement rétabli pour confirmer que le filet échoue bien dessus. Deux
contrôles trop zélés ont été retirés ou corrigés en chemin — un filet qui échoue
sur du bon code ne vaut pas mieux que pas de filet.

`lint` · `build` · unitaires · bout en bout · intégration : tout au vert.

### Impact au déploiement

- **`HOST_EMAIL` accepte désormais plusieurs adresses**, séparées par des
  virgules. Une seule adresse continue de fonctionner. Vide = mode dev ouvert.
- **Nouveau stockage** : `data/owners/<id>.json`, un fichier par compte. L'ancien
  `data/banks.json` est repris **sans être modifié ni supprimé** — il reste
  comme filet. Aucune action manuelle.
- **Migration Supabase** `20260820_durcissement_handle_new_user.sql` : déjà
  appliquée en production.
- Les inscriptions sont fermées ; les deux comptes animateur existent.

### Reste ouvert

- **O2 — nom et domaine définitifs.** Le nom visible vit désormais en un seul
  endroit (`src/client/shared/marque.js`) ; le jour où le choix sera fait, il n'y
  aura qu'une ligne à écrire. `render.yaml` se traitera avec le domaine, pas
  avant.

`49 fichiers · +6505 / −709`
