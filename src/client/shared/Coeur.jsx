// LE CŒUR DU « COUP DE CŒUR » de « Cueillette » — un seul tracé pour la console
// et le stream (07/10, 11/10). Au trait, comme le reste du registre : jamais
// d'emoji. `plein` le remplit — c'est l'état « désigné ».
export function Coeur({ s = 16, plein = false }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={plein ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}
