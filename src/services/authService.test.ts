import { describe, expect, it } from 'vitest';
import { PASSWORD_RECOVERY_NEUTRAL_MESSAGE, normalizeEmail } from './authService';

describe('Auth hardening', () => {
  it('uses a neutral password-recovery message', () => {
    expect(PASSWORD_RECOVERY_NEUTRAL_MESSAGE).toBe(
      'Se existir uma conta para este e-mail, enviaremos as instruções.',
    );
  });

  it('normalizes login identifiers without changing auth storage', () => {
    expect(normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
  });
});
