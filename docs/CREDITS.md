# Crédits et licences des ressources

Ce fichier recense ce que le jeu embarque et qui n'a pas été produit ici. Il fait
partie des obligations de licence, pas de la documentation d'agrément : une
ressource sous CC BY employée sans attribution est employée sans licence.

---

## Les visages du jeu « Les visages »

**200 portraits fournis par l'auteur.** Les droits et la licence de ces images
relèvent de lui ; ce dépôt les sert, il ne les revendique pas. Si une attribution
est due à leur source, elle se pose ici.

**Traitement appliqué** : conversion en WebP, et rien d'autre. Les images sont
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

## Polices

- **Mulish**, **Barlow Semi Condensed**, **IBM Plex Mono** — licence SIL Open
  Font License 1.1, auto-hébergées dans `src/public/fonts/`.
  Voir `design/tokens/tokens.css` pour le détail des graisses embarquées.
