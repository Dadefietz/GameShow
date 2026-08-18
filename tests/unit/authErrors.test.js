// Tests unitaires — messages d'erreur de connexion animateur.
import { describe, it, expect } from 'vitest';
import { otpErrorMessage } from '../../src/client/shared/authErrors.js';

describe('otpErrorMessage', () => {
  it("explique qu'aucun compte ne correspond quand les inscriptions sont fermées", () => {
    // Cas réel rencontré en production le 2026-08-18 (inscriptions publiques désactivées).
    expect(otpErrorMessage({ code: 'signup_disabled', message: 'Signups not allowed for this instance' }))
      .toMatch(/Aucun compte animateur/);
    expect(otpErrorMessage({ code: 'otp_disabled', message: 'Signups not allowed for otp' }))
      .toMatch(/Aucun compte animateur/);
    // Certaines versions du SDK exposent error_code au lieu de code.
    expect(otpErrorMessage({ error_code: 'otp_disabled', message: '' }))
      .toMatch(/Aucun compte animateur/);
  });

  it('distingue le quota d\'emails atteint', () => {
    expect(otpErrorMessage({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }))
      .toMatch(/Patientez/);
  });

  it('signale une adresse invalide', () => {
    expect(otpErrorMessage({ message: 'Unable to validate email address: invalid format' }))
      .toMatch(/pas valide/);
  });

  it('reste générique mais non trompeur sur une erreur inconnue', () => {
    const m = otpErrorMessage({ message: 'network down' });
    expect(m).toMatch(/Réessayez/);
    expect(m).not.toMatch(/Vérifiez l'adresse/); // ne renvoie plus vers une fausse piste
  });

  it('ne casse pas sur une erreur vide', () => {
    expect(typeof otpErrorMessage(null)).toBe('string');
    expect(typeof otpErrorMessage(undefined)).toBe('string');
  });
});
