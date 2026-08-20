// Tests unitaires — messages d'authentification et masquage de l'adresse.
//
// Un « Vérifiez l'adresse » générique envoie chercher au mauvais endroit : chaque
// cas doit dire ce qui se passe RÉELLEMENT. Depuis le passage au mot de passe
// (action 9), le mail ne sert plus qu'à la réinitialisation — c'est donc le seul
// chemin qui puisse encore buter sur le quota d'envoi de l'hébergeur.
import { describe, it, expect } from 'vitest';
import { passwordErrorMessage, resetErrorMessage, masquerEmail } from '../../src/client/shared/authErrors.js';

describe('passwordErrorMessage', () => {
  it('ne distingue pas le compte inconnu du mauvais mot de passe', () => {
    // DÉLIBÉRÉ : dire « ce compte n'existe pas » révélerait quelles adresses sont
    // des comptes animateur. Le message reste le même dans les deux cas.
    expect(passwordErrorMessage({ code: 'invalid_credentials' }))
      .toBe('Adresse ou mot de passe incorrect.');
    expect(passwordErrorMessage({ message: 'Invalid login credentials' }))
      .toBe('Adresse ou mot de passe incorrect.');
  });

  it('signale un compte non confirmé, qui se règle autrement', () => {
    expect(passwordErrorMessage({ code: 'email_not_confirmed' }))
      .toMatch(/pas encore confirmé/);
  });

  it('explique un mot de passe devenu trop faible, et la sortie', () => {
    // Cas contre-intuitif : le mot de passe est le bon, mais les exigences ont
    // été durcies depuis. Le message doit dire quoi faire, pas « réessayez ».
    const m = passwordErrorMessage({ code: 'weak_password' });
    expect(m).toMatch(/exigences de sécurité/);
    expect(m).toMatch(/Mot de passe oublié/);
  });

  it('distingue la limitation des tentatives, qui est une protection', () => {
    expect(passwordErrorMessage({ code: 'over_request_rate_limit' }))
      .toMatch(/Trop de tentatives/);
  });

  it('reste générique mais non trompeur sur une erreur inconnue', () => {
    expect(passwordErrorMessage({ message: 'boom' })).toBe('Connexion impossible. Réessayez dans un instant.');
  });

  it('ne casse pas sur une erreur vide', () => {
    expect(typeof passwordErrorMessage(null)).toBe('string');
    expect(typeof passwordErrorMessage(undefined)).toBe('string');
  });
});

describe('resetErrorMessage', () => {
  it('explique le quota d\'envoi, seul chemin qui passe encore par un mail', () => {
    expect(resetErrorMessage({ code: 'over_email_send_rate_limit' })).toMatch(/Patientez/);
  });
});

describe('masquerEmail', () => {
  // Ce que ça protège : l'écran animateur qui passe à l'antenne lors d'un partage
  // d'écran. On garde de quoi RECONNAÎTRE le compte, pas de quoi le recopier.
  it('laisse reconnaître le compte sans le livrer', () => {
    const masque = masquerEmail('theodore@exemple.fr');
    expect(masque.startsWith('t')).toBe(true);
    expect(masque).toContain('.fr');
    expect(masque).not.toContain('heodore');
    expect(masque).not.toContain('exemple');
  });

  it('ne laisse pas fuiter le domaine', () => {
    expect(masquerEmail('a@gmail.com')).not.toContain('gmail');
  });

  it('ne casse pas sur une entrée absente ou malformée', () => {
    expect(masquerEmail('')).toBe('');
    expect(masquerEmail(null)).toBe('');
    expect(masquerEmail('sans-arobase')).toBe('•••');
  });
});
