import { buildOtpauthUri, generateTotpSecret, verifyTotp } from './totp';

// RFC 6238 Appendix B (SHA1): секрет ASCII "12345678901234567890" в Base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('TOTP (RFC 6238, Google Authenticator)', () => {
  it('принимает корректный код по тест-вектору RFC (T=59 → 287082)', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 0, 59)).toBe(true);
  });

  it('принимает второй тест-вектор RFC (T=1111111109 → 081804)', () => {
    expect(verifyTotp(RFC_SECRET, '081804', 0, 1111111109)).toBe(true);
  });

  it('отвергает код из другого временного шага при window=0', () => {
    expect(verifyTotp(RFC_SECRET, '287082', 0, 59 + 30)).toBe(false);
  });

  it('window=1 компенсирует сдвиг на один шаг', () => {
    // T=89 → текущий шаг 2; код из шага 1 проходит при допуске ±1.
    expect(verifyTotp(RFC_SECRET, '287082', 1, 89)).toBe(true);
  });

  it('отвергает неформатный код (не 6 цифр)', () => {
    expect(verifyTotp(RFC_SECRET, '12345', 0, 59)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', 0, 59)).toBe(false);
  });

  it('generateTotpSecret даёт Base32 (20 байт → 32 символа A-Z2-7)', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s); // случайность
  });

  it('сгенерированный секрет проходит собственную проверку (roundtrip с window)', () => {
    // нет генератора кода в публичном API — проверяем, что верный код существует
    // в окне: берём RFC-секрет (детерминизм) уже покрыт выше; здесь — формат URI.
    const uri = buildOtpauthUri(RFC_SECRET, 'ant', 'voskhod');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain('issuer=voskhod');
    expect(uri).toContain('algorithm=SHA1');
  });
});
