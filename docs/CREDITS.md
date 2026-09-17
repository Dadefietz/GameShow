# Crédits et licences des ressources

Ce fichier recense ce que le jeu embarque et qui n'a pas été produit ici. Il fait
partie des obligations de licence, pas de la documentation d'agrément : une
ressource sous CC BY employée sans attribution est employée sans licence.

---

## Les visages du jeu « Les visages »

**200 portraits fournis par l'auteur, deuxième banque.** Les droits et la licence
de ces images relèvent de lui ; ce dépôt les sert, il ne les revendique pas. Si
une attribution est due à leur source, elle se pose ici.

La banque est arrivée en quatre archives, la dernière — `101`–`150` — avec un
jour de retard sur les trois autres. Pendant ce temps la liste a tourné à 150
visages, avec un trou entre `v100` et `v151` : la numérotation de l'auteur a été
conservée telle quelle. Les cinquante manquants se sont glissés à leur place sans
qu'une ligne existante ne bouge.

Cette banque REMPLACE celle de la première séance, également fournie par
l'auteur ; les fichiers portent les mêmes noms et le même format.

**Traitement appliqué** : conversion en WebP — qualité 82, méthode 6 — et rien
d'autre. Le réglage est écrit ici parce qu'il a fallu le RETROUVER pour convertir
la dernière archive : les cinquante fichiers rendus à un autre réglage auraient
pesé et grainé autrement que les cent cinquante autres, et rien ne l'aurait
signalé. Il a été vérifié en réencodant deux portraits déjà intégrés et en
comparant les fichiers OCTET PAR OCTET aux versions du dépôt. Les images sont
livrées en 512 × 512, déjà cadrées de façon homogène — fond gris uniforme,
t-shirt blanc, expression neutre, cadrage frontal. Ni le fond, ni la lumière, ni
les visages n'ont été touchés.

**Pourquoi cette homogénéité compte** : sur un jeu de reconnaissance, un fond qui
change ou un vêtement reconnaissable sont des repères de mémoire qui remplacent
la reconnaissance des visages par celle des décors. Le jeu mesurerait alors autre
chose que ce qu'il prétend mesurer. Cette régularité a été vérifiée à l'œil, sur
planche contact, avant intégration — aucun contrôle automatique ne peut la juger.

### Ce qui servait avant, et pourquoi ce n'est plus là

**Face Research Lab London Set** (DeBruine & Jones, université de Glasgow, CC BY
4.0, https://doi.org/10.6084/m9.figshare.5047666.v5) a servi de banque pendant une
séance. 102 personnes seulement — le plafond de ce qui existait sous une licence
autorisant la diffusion publique — et une composition très déséquilibrée : 69
personnes blanches sur 102. Les 200 portraits fournis par l'auteur lèvent les deux
limites d'un coup.

Les autres bases de visages à fond uniforme avaient été écartées pour leur
licence : FEI l'écrit noir sur blanc (« research purposes only ») ; la Chicago
Face Database interdit explicitement la publication et la redistribution sans
accord écrit de l'université de Chicago ; KDEF et Radboud sont réservées à un
usage non commercial.

**SFHQ** (visages synthétiques) avait été examiné en premier et écarté après
essai : ses fonds varient d'une image à l'autre, une partie du corpus n'est pas
photoréaliste, et la normalisation du fond par masque ovale — essayée, mesurée —
laissait des morceaux de décor, amputait les chevelures et ne corrigeait ni la
pose ni la lumière.

## Les objets du jeu « Cache-cache »

**200 icônes fournies par l'auteur** : quarante objets déclinés dans les cinq
mêmes couleurs (bleu, jaune, rose, rouge, vert). Les droits et la licence de ces
images relèvent de lui ; ce dépôt les sert, il ne les revendique pas. Si une
attribution est due à leur source, elle se pose ici.

**Traitement appliqué** : détourage du fond blanc, puis conversion en WebP —
qualité 82, méthode 6, le réglage de la banque de portraits.

**Le détourage part des BORDS**, il ne rend pas « tout le blanc » transparent. La
distinction n'est pas un détail : le verre d'une ampoule, la vitre d'une voiture
et les hublots d'un avion sont blancs eux aussi. Un détourage naïf les aurait
troués, et l'objet serait apparu percé sur la plaque claire de sa case.

**Le nom et la couleur sont déclarés dans `src/server/objets.js`**, pas lus dans
le nom de fichier. Ils ne sont pas décoratifs : les questions du jeu portent sur
eux, et les règles de tirage les contraignent. Un jeu qui lirait ses données dans
un nom de fichier se casserait au premier renommage, sans que personne sache
pourquoi.

**Les images déposées depuis le Studio suivent LE MÊME traitement.** Il est
refait dans le navigateur (`src/client/studio/imageObjet.js`) : détourage par les
bords, 512 px de côté, WebP qualité 82. Le serveur ne décode jamais l'image — il
vérifie la signature d'octets, le poids et l'identifiant, puis range. Refaire la
conversion côté serveur demanderait `sharp`, trente mégaoctets de binaire natif
sur l'hébergeur, pour ce que le canevas fait en dix lignes ; et ne pas décoder un
fichier venu du dehors supprime une classe entière de défauts.

Une différence subsiste et elle est écrite ici pour n'avoir pas à la retrouver :
**l'encodeur WebP du navigateur n'est pas `cwebp` méthode 6**. À qualité égale,
il produit des fichiers légèrement différents des deux cents icônes d'origine. Sur
des aplats de couleur à douze kilo-octets, l'écart ne se voit pas ; il se verrait
sur des photographies, et c'est pourquoi la banque de portraits, elle, n'est pas
déposable par cette voie.

**Quarante icônes NOIRES sont venues s'y ajouter** (séance du 12/09) : les mêmes
quarante objets, en une seule déclinaison sans couleur. Elles servent le mode
« Classique », et elles seules — le document l'écrit en capitales. Même
traitement : détourage par les bords, 512 px, WebP 82. Le détourage compte
davantage encore ici : sur un dessin noir, un blanc enclos percé par erreur — le
siège d'une chaise, l'écran d'une télévision, les fentes d'une clé à molette — se
verrait immédiatement. Vérifié sur planche contact avant intégration.

**« Noir » est une couleur RÉSERVÉE, pas une sixième couleur.** La banque est
unique — deux cent quarante lignes, une seule page de modération — et c'est le
MODE qui décide de la tranche employée. La compter comme une couleur ordinaire
aurait donné six couleurs sur neuf cases, donc trois couleurs uniques, et la
question « quelle couleur n'est présente qu'une seule fois ? » aurait perdu sa
réponse.

**Où vont ces images.** Seau Supabase `objets`, lecture publique, écriture
réservée au service role — l'autorisation d'animateur est tenue côté serveur, à
un seul endroit. Le disque local ne sert qu'au développement, et l'écran le dit
lorsqu'il l'emploie : le disque de l'hébergeur repart vierge à chaque redémarrage,
c'est la leçon de M1.

**Ce fichier est le DÉPÔT, pas la dernière autorité.** Depuis la modération du
Studio, un module peut porter sa propre base d'images — nom, couleur et chemin
corrigés par l'animateur — et c'est elle que le tirage emploie alors. Le dépôt
sert de point de départ et de filet : une banque vidée au Studio y retombe plutôt
que d'éteindre le jeu. Ce que le Studio NE fait pas, c'est envoyer un fichier : il
n'existe pas de route pour cela, et l'écran le dit plutôt que de le laisser
découvrir. Une image ajoutée doit déjà être servie depuis `src/public/objets/`.

## Les dessins du jeu « Cueillette »

**Cinquante dessins au trait fournis par l'auteur**, en deux archives : dix
arbres, vingt fleurs, vingt fruits. Les droits et la licence relèvent de lui ; ce
dépôt les sert, il ne les revendique pas. Si une attribution est due à leur
source, elle se pose ici.

Les fichiers d'origine portaient des intitulés anglais suivis d'un identifiant de
trente-deux caractères. Ils sont rangés sous `d001` à `d050` dans
`src/public/dessins/`, et **leur nom français est DÉCLARÉ dans
`src/server/dessins.js`**, jamais lu dans le nom de fichier — la règle du dépôt
depuis la banque d'objets de « Cache-cache » : un jeu qui lit ses données dans un
nom de fichier se casse au premier renommage, sans que personne sache pourquoi.

**Traitement appliqué** : recadrage sur l'encre, centrage sur un carré avec six
pour cent de marge, 512 px, détourage du fond par les bords, puis WebP qualité 82
méthode 6 — le réglage du dépôt, celui des portraits et des objets. Total : 573 Ko
pour les cinquante.

- **Pourquoi un carré**, alors que les originaux sont en portrait : les rapports
  de leurs encres vont de 0,25 — un bouleau tout en hauteur — à 1,68 pour une
  tranche de pastèque. Une zone de dessin qui changerait de forme à chaque manche
  désorienterait les joueurs et rendrait invérifiable la règle « une zone de
  dessin d'exactement la même taille que l'image du dessin cible ».
- **Pourquoi recadrer** : l'encre n'occupait que 31 % à 79 % de l'image d'origine.
  Affichés tels quels, les dessins auraient paru minuscules au centre de l'écran,
  et les joueurs auraient dessiné petit dans une grande zone — ce que le calcul de
  ressemblance aurait puni sur les proportions, pour une raison qui ne les regarde
  pas.
- **Pourquoi le détourage part des BORDS** et non de « tout le blanc » : le creux
  d'un avocat, la chair d'une noix de coco et le cœur d'une figue sont blancs eux
  aussi. Un détourage naïf les aurait percés, et le dessin serait apparu troué sur
  la plaque claire de sa case. Vérifié sur planche contact avant intégration.

**Ce que le dépôt embarque en plus des images** : `src/server/dessins-grilles.js`,
68 Ko de grilles 64 × 64 précalculées à la conversion — deux par dessin. Elles
existent parce que le serveur doit COMPARER la cible au tracé d'un joueur sans
décoder d'image à l'antenne ; elles se régénèrent depuis les WebP et ne sont pas
une source. Une grille vide noterait tout le monde à zéro en silence : un contrôle
les parcourt toutes les cinquante et vérifie qu'elles portent de l'encre.

## Polices

- **Mulish**, **Barlow Semi Condensed**, **IBM Plex Mono** — licence SIL Open
  Font License 1.1, auto-hébergées dans `src/public/fonts/`.
  Voir `design/tokens/tokens.css` pour le détail des graisses embarquées.
