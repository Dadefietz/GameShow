# Crédits et licences des ressources

Ce fichier recense ce que le jeu embarque et qui n'a pas été produit ici. Il fait
partie des obligations de licence, pas de la documentation d'agrément : une
ressource sous CC BY employée sans attribution est employée sans licence.

---

## Les visages du jeu « Les visages »

**Face Research Lab London Set**
Lisa DeBruine et Benedict Jones — Face Research Lab, université de Glasgow.
102 personnes photographiées en studio, expression neutre, de face.

- Source : https://doi.org/10.6084/m9.figshare.5047666.v5
- Licence : **Creative Commons Attribution 4.0 International (CC BY 4.0)**
  https://creativecommons.org/licenses/by/4.0/

**Ce que la licence exige** : citer les auteurs, indiquer la licence, et signaler
les modifications apportées. Elle autorise l'usage commercial et la diffusion
publique — ce qui, sur ce sujet, est rare.

**Modifications apportées** : recadrage carré à 80 % du cadre d'origine, calé
au-dessus du centre pour conserver la chevelure ; redimensionnement à 512 px ;
conversion en WebP. Aucune retouche du fond, de la lumière ni des visages.

**Où cette attribution doit apparaître** : ici, et dans
`src/server/visages.js`, qui est le fichier de la banque. Une mention à
l'antenne — générique de fin, ou description de la diffusion — est la lecture la
plus sûre de « in any reasonable manner » pour un programme diffusé. **Point à
trancher.**

### Pourquoi celle-là et pas une autre

Presque toutes les bases de visages à fond uniforme sont réservées à la
recherche, ce qu'un jeu diffusé en public n'est pas :

| Base | Personnes | Fond | Licence | Diffusion publique |
| --- | --- | --- | --- | --- |
| **Face Research Lab London** | **102** | uniforme | **CC BY 4.0** | **oui** |
| Chicago Face Database | 597 | blanc uniforme | recherche ; autre usage sur demande | sur autorisation |
| FEI (Brésil) | 200 | blanc uniforme | « research purposes only » | non |
| KDEF | 70 | uniforme | non commercial | non |
| Radboud (RaFD) | 67 | uniforme | recherche, sur candidature | non |

La Chicago Face Database est la piste pour aller au-delà de 102 : mêmes
conditions de studio, 597 personnes, et son équipe accorde l'usage hors recherche
sur demande. C'est une lettre à écrire. Le jour où l'autorisation arrive, seul
`src/server/visages.js` change.

### Ce qui a été écarté, et pourquoi

**SFHQ** (Synthetic Faces High Quality, ~425 000 visages synthétiques) a été
examiné en premier : aucune personne réelle, donc aucun droit à l'image, et un
effectif sans limite. Deux raisons l'ont fait écarter :

- **les fonds varient d'une image à l'autre** — il est dérivé de StyleGAN2, donc
  de photographies. Sur un jeu de reconnaissance, un fond distinctif est un
  repère de mémoire qui remplace la reconnaissance du visage : le jeu mesurerait
  autre chose que ce qu'il prétend mesurer ;
- une partie du corpus n'est pas photoréaliste (visages peints, rendus 3D,
  illustrations), ce qui rend certaines images immédiatement mémorables.

---

## Polices

- **Mulish**, **Barlow Semi Condensed**, **IBM Plex Mono** — licence SIL Open
  Font License 1.1, auto-hébergées dans `src/public/fonts/`.
  Voir `design/tokens/tokens.css` pour le détail des graisses embarquées.
