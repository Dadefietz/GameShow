// Tests unitaires — UN ÉCRAN AU CODE PÉRIMÉ SE SAIT PÉRIMÉ (26/10).
//
// « À 11 joueurs, je n'avais accès qu'à "Coup de cœur" » : la console tournait le
// code d'avant le haut le cœur, ouverte avant la mise en ligne. Le serveur lit la
// version dans son `index.html` ; l'écran lit la sienne dans ses balises.
import { describe, it, expect } from 'vitest';
import { versionDuBuild } from '../../src/server/version-client.js';
import { versionChargee, estPerimee } from '../../src/client/shared/version.js';

const fauxDocument = (...srcs) => ({
  querySelectorAll: () => srcs.map((src) => ({ getAttribute: () => src })),
});

describe('la version du client', () => {
  it('le serveur la lit dans le index.html du build', () => {
    const html = '<script type="module" crossorigin src="/assets/index-C6zj9ng2.js"></script><link rel="stylesheet" href="/assets/index-Dq1.css">';
    expect(versionDuBuild(html)).toBe('index-C6zj9ng2.js');
    // En développement, Vite sert la source : pas d'empreinte, pas de version.
    expect(versionDuBuild('<script type="module" src="/src/main.jsx"></script>')).toBe(null);
    expect(versionDuBuild(undefined)).toBe(null);
  });

  it('l’écran la lit dans ses balises de script, et ignore les autres', () => {
    expect(versionChargee(fauxDocument('/src/main.jsx', '/assets/index-AbC_1-2.js'))).toBe('index-AbC_1-2.js');
    expect(versionChargee(fauxDocument('/assets/HostApp-BwQJcycN.js'))).toBe(null);
    expect(versionChargee(null)).toBe(null);
  });

  it('PÉRIMÉ seulement quand les deux sont connues et diffèrent', () => {
    expect(estPerimee('index-NEUF.js', 'index-VIEUX.js')).toBe(true);
    expect(estPerimee('index-NEUF.js', 'index-NEUF.js')).toBe(false);
    // Développement : ni l'un ni l'autre ne doit s'alarmer.
    expect(estPerimee(null, 'index-VIEUX.js')).toBe(false);
    expect(estPerimee('index-NEUF.js', null)).toBe(false);
  });
});
