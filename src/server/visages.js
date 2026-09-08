// LE BASSIN DE VISAGES DE « LES VISAGES ».
//
// ============================================================================
// D'OÙ VIENNENT CES PORTRAITS
// ============================================================================
//
// 200 portraits FOURNIS PAR L'AUTEUR, en remplacement du Face Research Lab
// London Set qui servait jusqu'ici. Les droits et la licence de ces images
// relèvent de lui ; ce dépôt les sert, il ne les revendique pas.
// Voir docs/CREDITS.md.
//
// CE QU'ILS ONT DE JUSTE POUR CE JEU, et c'est ce qui a été vérifié à l'œil sur
// planche contact avant intégration : fond gris uniforme, t-shirt blanc pour
// tout le monde, expression neutre, cadrage frontal identique, 512 × 512. Rien
// d'autre que le visage ne distingue deux images — or c'est exactement ce que le
// jeu demande. Un fond qui change ou un vêtement reconnaissable seraient des
// repères de mémoire qui remplaceraient la reconnaissance des visages par celle
// des décors, et le jeu mesurerait alors autre chose que ce qu'il prétend
// mesurer.
//
// TRAITEMENT : conversion en WebP, et rien d'autre. Pas de recadrage — les
// images sont livrées carrées, au bon format et déjà cadrées de façon homogène.
// Ni le fond, ni la lumière, ni les visages n'ont été touchés.
//
// ============================================================================
// L'EFFECTIF
// ============================================================================
//
// 200 visages. Une série en consomme 19 :
//   - cinq manches dans une soirée sans qu'un seul visage se répète ;
//   - au-delà, des visages reviendront d'une manche à l'autre. Rien ne casse —
//     le visage doublé se tire dans chaque manche indépendamment — mais un
//     joueur peut croire reconnaître quelqu'un vu à la manche précédente.
// C'est presque le double de ce que permettait la banque précédente (102).

export const BASSIN_VISAGES = [
  { id: 'v001', src: '/visages/v001.webp' },
  { id: 'v002', src: '/visages/v002.webp' },
  { id: 'v003', src: '/visages/v003.webp' },
  { id: 'v004', src: '/visages/v004.webp' },
  { id: 'v005', src: '/visages/v005.webp' },
  { id: 'v006', src: '/visages/v006.webp' },
  { id: 'v007', src: '/visages/v007.webp' },
  { id: 'v008', src: '/visages/v008.webp' },
  { id: 'v009', src: '/visages/v009.webp' },
  { id: 'v010', src: '/visages/v010.webp' },
  { id: 'v011', src: '/visages/v011.webp' },
  { id: 'v012', src: '/visages/v012.webp' },
  { id: 'v013', src: '/visages/v013.webp' },
  { id: 'v014', src: '/visages/v014.webp' },
  { id: 'v015', src: '/visages/v015.webp' },
  { id: 'v016', src: '/visages/v016.webp' },
  { id: 'v017', src: '/visages/v017.webp' },
  { id: 'v018', src: '/visages/v018.webp' },
  { id: 'v019', src: '/visages/v019.webp' },
  { id: 'v020', src: '/visages/v020.webp' },
  { id: 'v021', src: '/visages/v021.webp' },
  { id: 'v022', src: '/visages/v022.webp' },
  { id: 'v023', src: '/visages/v023.webp' },
  { id: 'v024', src: '/visages/v024.webp' },
  { id: 'v025', src: '/visages/v025.webp' },
  { id: 'v026', src: '/visages/v026.webp' },
  { id: 'v027', src: '/visages/v027.webp' },
  { id: 'v028', src: '/visages/v028.webp' },
  { id: 'v029', src: '/visages/v029.webp' },
  { id: 'v030', src: '/visages/v030.webp' },
  { id: 'v031', src: '/visages/v031.webp' },
  { id: 'v032', src: '/visages/v032.webp' },
  { id: 'v033', src: '/visages/v033.webp' },
  { id: 'v034', src: '/visages/v034.webp' },
  { id: 'v035', src: '/visages/v035.webp' },
  { id: 'v036', src: '/visages/v036.webp' },
  { id: 'v037', src: '/visages/v037.webp' },
  { id: 'v038', src: '/visages/v038.webp' },
  { id: 'v039', src: '/visages/v039.webp' },
  { id: 'v040', src: '/visages/v040.webp' },
  { id: 'v041', src: '/visages/v041.webp' },
  { id: 'v042', src: '/visages/v042.webp' },
  { id: 'v043', src: '/visages/v043.webp' },
  { id: 'v044', src: '/visages/v044.webp' },
  { id: 'v045', src: '/visages/v045.webp' },
  { id: 'v046', src: '/visages/v046.webp' },
  { id: 'v047', src: '/visages/v047.webp' },
  { id: 'v048', src: '/visages/v048.webp' },
  { id: 'v049', src: '/visages/v049.webp' },
  { id: 'v050', src: '/visages/v050.webp' },
  { id: 'v051', src: '/visages/v051.webp' },
  { id: 'v052', src: '/visages/v052.webp' },
  { id: 'v053', src: '/visages/v053.webp' },
  { id: 'v054', src: '/visages/v054.webp' },
  { id: 'v055', src: '/visages/v055.webp' },
  { id: 'v056', src: '/visages/v056.webp' },
  { id: 'v057', src: '/visages/v057.webp' },
  { id: 'v058', src: '/visages/v058.webp' },
  { id: 'v059', src: '/visages/v059.webp' },
  { id: 'v060', src: '/visages/v060.webp' },
  { id: 'v061', src: '/visages/v061.webp' },
  { id: 'v062', src: '/visages/v062.webp' },
  { id: 'v063', src: '/visages/v063.webp' },
  { id: 'v064', src: '/visages/v064.webp' },
  { id: 'v065', src: '/visages/v065.webp' },
  { id: 'v066', src: '/visages/v066.webp' },
  { id: 'v067', src: '/visages/v067.webp' },
  { id: 'v068', src: '/visages/v068.webp' },
  { id: 'v069', src: '/visages/v069.webp' },
  { id: 'v070', src: '/visages/v070.webp' },
  { id: 'v071', src: '/visages/v071.webp' },
  { id: 'v072', src: '/visages/v072.webp' },
  { id: 'v073', src: '/visages/v073.webp' },
  { id: 'v074', src: '/visages/v074.webp' },
  { id: 'v075', src: '/visages/v075.webp' },
  { id: 'v076', src: '/visages/v076.webp' },
  { id: 'v077', src: '/visages/v077.webp' },
  { id: 'v078', src: '/visages/v078.webp' },
  { id: 'v079', src: '/visages/v079.webp' },
  { id: 'v080', src: '/visages/v080.webp' },
  { id: 'v081', src: '/visages/v081.webp' },
  { id: 'v082', src: '/visages/v082.webp' },
  { id: 'v083', src: '/visages/v083.webp' },
  { id: 'v084', src: '/visages/v084.webp' },
  { id: 'v085', src: '/visages/v085.webp' },
  { id: 'v086', src: '/visages/v086.webp' },
  { id: 'v087', src: '/visages/v087.webp' },
  { id: 'v088', src: '/visages/v088.webp' },
  { id: 'v089', src: '/visages/v089.webp' },
  { id: 'v090', src: '/visages/v090.webp' },
  { id: 'v091', src: '/visages/v091.webp' },
  { id: 'v092', src: '/visages/v092.webp' },
  { id: 'v093', src: '/visages/v093.webp' },
  { id: 'v094', src: '/visages/v094.webp' },
  { id: 'v095', src: '/visages/v095.webp' },
  { id: 'v096', src: '/visages/v096.webp' },
  { id: 'v097', src: '/visages/v097.webp' },
  { id: 'v098', src: '/visages/v098.webp' },
  { id: 'v099', src: '/visages/v099.webp' },
  { id: 'v100', src: '/visages/v100.webp' },
  { id: 'v101', src: '/visages/v101.webp' },
  { id: 'v102', src: '/visages/v102.webp' },
  { id: 'v103', src: '/visages/v103.webp' },
  { id: 'v104', src: '/visages/v104.webp' },
  { id: 'v105', src: '/visages/v105.webp' },
  { id: 'v106', src: '/visages/v106.webp' },
  { id: 'v107', src: '/visages/v107.webp' },
  { id: 'v108', src: '/visages/v108.webp' },
  { id: 'v109', src: '/visages/v109.webp' },
  { id: 'v110', src: '/visages/v110.webp' },
  { id: 'v111', src: '/visages/v111.webp' },
  { id: 'v112', src: '/visages/v112.webp' },
  { id: 'v113', src: '/visages/v113.webp' },
  { id: 'v114', src: '/visages/v114.webp' },
  { id: 'v115', src: '/visages/v115.webp' },
  { id: 'v116', src: '/visages/v116.webp' },
  { id: 'v117', src: '/visages/v117.webp' },
  { id: 'v118', src: '/visages/v118.webp' },
  { id: 'v119', src: '/visages/v119.webp' },
  { id: 'v120', src: '/visages/v120.webp' },
  { id: 'v121', src: '/visages/v121.webp' },
  { id: 'v122', src: '/visages/v122.webp' },
  { id: 'v123', src: '/visages/v123.webp' },
  { id: 'v124', src: '/visages/v124.webp' },
  { id: 'v125', src: '/visages/v125.webp' },
  { id: 'v126', src: '/visages/v126.webp' },
  { id: 'v127', src: '/visages/v127.webp' },
  { id: 'v128', src: '/visages/v128.webp' },
  { id: 'v129', src: '/visages/v129.webp' },
  { id: 'v130', src: '/visages/v130.webp' },
  { id: 'v131', src: '/visages/v131.webp' },
  { id: 'v132', src: '/visages/v132.webp' },
  { id: 'v133', src: '/visages/v133.webp' },
  { id: 'v134', src: '/visages/v134.webp' },
  { id: 'v135', src: '/visages/v135.webp' },
  { id: 'v136', src: '/visages/v136.webp' },
  { id: 'v137', src: '/visages/v137.webp' },
  { id: 'v138', src: '/visages/v138.webp' },
  { id: 'v139', src: '/visages/v139.webp' },
  { id: 'v140', src: '/visages/v140.webp' },
  { id: 'v141', src: '/visages/v141.webp' },
  { id: 'v142', src: '/visages/v142.webp' },
  { id: 'v143', src: '/visages/v143.webp' },
  { id: 'v144', src: '/visages/v144.webp' },
  { id: 'v145', src: '/visages/v145.webp' },
  { id: 'v146', src: '/visages/v146.webp' },
  { id: 'v147', src: '/visages/v147.webp' },
  { id: 'v148', src: '/visages/v148.webp' },
  { id: 'v149', src: '/visages/v149.webp' },
  { id: 'v150', src: '/visages/v150.webp' },
  { id: 'v151', src: '/visages/v151.webp' },
  { id: 'v152', src: '/visages/v152.webp' },
  { id: 'v153', src: '/visages/v153.webp' },
  { id: 'v154', src: '/visages/v154.webp' },
  { id: 'v155', src: '/visages/v155.webp' },
  { id: 'v156', src: '/visages/v156.webp' },
  { id: 'v157', src: '/visages/v157.webp' },
  { id: 'v158', src: '/visages/v158.webp' },
  { id: 'v159', src: '/visages/v159.webp' },
  { id: 'v160', src: '/visages/v160.webp' },
  { id: 'v161', src: '/visages/v161.webp' },
  { id: 'v162', src: '/visages/v162.webp' },
  { id: 'v163', src: '/visages/v163.webp' },
  { id: 'v164', src: '/visages/v164.webp' },
  { id: 'v165', src: '/visages/v165.webp' },
  { id: 'v166', src: '/visages/v166.webp' },
  { id: 'v167', src: '/visages/v167.webp' },
  { id: 'v168', src: '/visages/v168.webp' },
  { id: 'v169', src: '/visages/v169.webp' },
  { id: 'v170', src: '/visages/v170.webp' },
  { id: 'v171', src: '/visages/v171.webp' },
  { id: 'v172', src: '/visages/v172.webp' },
  { id: 'v173', src: '/visages/v173.webp' },
  { id: 'v174', src: '/visages/v174.webp' },
  { id: 'v175', src: '/visages/v175.webp' },
  { id: 'v176', src: '/visages/v176.webp' },
  { id: 'v177', src: '/visages/v177.webp' },
  { id: 'v178', src: '/visages/v178.webp' },
  { id: 'v179', src: '/visages/v179.webp' },
  { id: 'v180', src: '/visages/v180.webp' },
  { id: 'v181', src: '/visages/v181.webp' },
  { id: 'v182', src: '/visages/v182.webp' },
  { id: 'v183', src: '/visages/v183.webp' },
  { id: 'v184', src: '/visages/v184.webp' },
  { id: 'v185', src: '/visages/v185.webp' },
  { id: 'v186', src: '/visages/v186.webp' },
  { id: 'v187', src: '/visages/v187.webp' },
  { id: 'v188', src: '/visages/v188.webp' },
  { id: 'v189', src: '/visages/v189.webp' },
  { id: 'v190', src: '/visages/v190.webp' },
  { id: 'v191', src: '/visages/v191.webp' },
  { id: 'v192', src: '/visages/v192.webp' },
  { id: 'v193', src: '/visages/v193.webp' },
  { id: 'v194', src: '/visages/v194.webp' },
  { id: 'v195', src: '/visages/v195.webp' },
  { id: 'v196', src: '/visages/v196.webp' },
  { id: 'v197', src: '/visages/v197.webp' },
  { id: 'v198', src: '/visages/v198.webp' },
  { id: 'v199', src: '/visages/v199.webp' },
  { id: 'v200', src: '/visages/v200.webp' },
];

export function idsDuBassin() {
  return BASSIN_VISAGES.map((v) => v.id);
}

// L'ADRESSE D'UN VISAGE, ET LE SEUL ENDROIT QUI LA CONNAISSE.
//
// Le client ne déduit JAMAIS une adresse d'un identifiant : il reçoit l'une et
// l'autre du serveur. Sans cette règle, la convention de nommage vivrait à deux
// endroits — ici et dans le client — et le jour où la banque changera de noms de
// fichiers, il faudrait s'en souvenir des deux côtés.
const PAR_ID = new Map(BASSIN_VISAGES.map((v) => [v.id, v]));
export function srcDeVisage(id) {
  return PAR_ID.get(id)?.src || null;
}
