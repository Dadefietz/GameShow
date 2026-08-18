// Tests unitaires — cloisonnement de la session animateur par compte (anti-héritage
// du salon d'un autre compte sur le même navigateur).
import { describe, it, expect } from 'vitest';
import { shouldPurgeHostSession } from '../../src/client/shared/hostSession.js';

const SESSION_A = { code: 'ABCDE', hostToken: 'jwt-a', overlayToken: 'ov-a', ownerId: 'user-a' };
const USER_A = { id: 'user-a', email: 'animateur@exemple.fr' };
const USER_B = { id: 'user-b', email: 'intrus@exemple.fr' };

describe('shouldPurgeHostSession', () => {
  it("purge la session quand un AUTRE compte se connecte (le cas signalé en production)", () => {
    expect(shouldPurgeHostSession(SESSION_A, USER_B)).toBe(true);
  });

  it('conserve la session du compte propriétaire', () => {
    expect(shouldPurgeHostSession(SESSION_A, USER_A)).toBe(false);
  });

  it('purge une session sans propriétaire (format antérieur) dès qu\'un compte est connecté', () => {
    const legacy = { code: 'ABCDE', hostToken: 'jwt', overlayToken: 'ov' }; // pas d'ownerId
    expect(shouldPurgeHostSession(legacy, USER_A)).toBe(true);
    expect(shouldPurgeHostSession({ ...legacy, ownerId: null }, USER_A)).toBe(true);
  });

  it("ne purge pas quand personne n'est authentifié (pas de coupure en pleine partie)", () => {
    expect(shouldPurgeHostSession(SESSION_A, null)).toBe(false);
    expect(shouldPurgeHostSession(SESSION_A, undefined)).toBe(false);
  });

  it('ne fait rien sans session mémorisée', () => {
    expect(shouldPurgeHostSession(null, USER_A)).toBe(false);
    expect(shouldPurgeHostSession(undefined, null)).toBe(false);
  });
});
