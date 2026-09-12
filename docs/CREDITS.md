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

**Ce fichier est le DÉPÔT, pas la dernière autorité.** Depuis la modération du
Studio, un module peut porter sa propre base d'images — nom, couleur et chemin
corrigés par l'animateur — et c'est elle que le tirage emploie alors. Le dépôt
sert de point de départ et de filet : une banque vidée au Studio y retombe plutôt
que d'éteindre le jeu. Ce que le Studio NE fait pas, c'est envoyer un fichier : il
n'existe pas de route pour cela, et l'écran le dit plutôt que de le laisser
découvrir. Une image ajoutée doit déjà être servie depuis `src/public/objets/`.

## Polices

- **Mulish**, **Barlow Semi Condensed**, **IBM Plex Mono** — licence SIL Open
  Font License 1.1, auto-hébergées dans `src/public/fonts/`.
  Voir `design/tokens/tokens.css` pour le détail des graisses embarquées.
