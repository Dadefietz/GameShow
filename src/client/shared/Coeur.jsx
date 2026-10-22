// LE CŒUR DES DISTINCTIONS de « Cueillette » — un seul tracé pour la console et le
// stream (07/10, 11/10, 22/10). Au trait, comme le reste du registre : jamais
// d'emoji. `plein` le remplit — c'est l'état « désigné ». `brise` le fend d'une
// ligne brisée : c'est le HAUT LE CŒUR, l'inverse du coup de cœur.
//
// LA FISSURE SE VOIT AUSSI SUR UN CŒUR PLEIN : elle est tracée dans la couleur du
// fond de surface, par-dessus le remplissage — dans la couleur du trait, elle s'y
// serait fondue.
export function Coeur({ s = 16, plein = false, brise = false }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={plein ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
      {brise ? (
        <path d="M12 7.6l-1.6 3.4 2.8 2.2-2 3.6" fill="none"
          style={plein ? { stroke: 'var(--c-surface)' } : undefined} strokeWidth="1.7" />
      ) : null}
    </svg>
  );
}
