import { isSensitiveLogKey, redactSensitive, REDACTED, SENSITIVE_LOG_KEY_PATTERNS } from './log-redaction';

describe('log-redaction — маскирование секретов в логах (Story 8.7)', () => {
  describe('isSensitiveLogKey', () => {
    it('ловит секрет-имена без учёта регистра и как подстроку', () => {
      expect(isSensitiveLogKey('password')).toBe(true);
      expect(isSensitiveLogKey('PrivateKey')).toBe(true);
      expect(isSensitiveLogKey('user_private_key')).toBe(true);
      expect(isSensitiveLogKey('accessToken')).toBe(true);
      expect(isSensitiveLogKey('WIF')).toBe(true);
      expect(isSensitiveLogKey('mnemonicPhrase')).toBe(true);
      expect(isSensitiveLogKey('Authorization')).toBe(true);
    });

    it('НЕ ловит несекретные имена, включая publicKey/username', () => {
      expect(isSensitiveLogKey('username')).toBe(false);
      expect(isSensitiveLogKey('publicKey')).toBe(false);
      expect(isSensitiveLogKey('email')).toBe(false);
      expect(isSensitiveLogKey('id')).toBe(false);
    });

    it('publicKey не считается секретом (содержит key, но key не в паттернах)', () => {
      // в наборе нет голого "key" — только private_key/privatekey (см. дрейф 8.7)
      expect(SENSITIVE_LOG_KEY_PATTERNS).not.toContain('key');
    });
  });

  describe('redactSensitive', () => {
    it('маскирует значение секрет-ключа на верхнем уровне', () => {
      expect(redactSensitive({ password: 'p', email: 'e@x' })).toEqual({ password: REDACTED, email: 'e@x' });
    });

    it('маскирует на любой глубине вложенности', () => {
      const input = { user: { name: 'n', wallet: { privateKey: 'K', token: 'T' } } };
      expect(redactSensitive(input)).toEqual({
        user: { name: 'n', wallet: { privateKey: REDACTED, token: REDACTED } },
      });
    });

    it('секрет-имя самого контейнера маскирует его целиком (credentials)', () => {
      expect(redactSensitive({ credentials: { a: 1, b: 2 } })).toEqual({ credentials: REDACTED });
    });

    it('обходит массивы объектов', () => {
      const input = [{ secret: 's', ok: 1 }, { ok: 2 }];
      expect(redactSensitive(input)).toEqual([{ secret: REDACTED, ok: 1 }, { ok: 2 }]);
    });

    it('publicKey НЕ маскируется', () => {
      expect(redactSensitive({ publicKey: 'PUB' })).toEqual({ publicKey: 'PUB' });
    });

    it('примитивы возвращаются как есть', () => {
      expect(redactSensitive('s')).toBe('s');
      expect(redactSensitive(42)).toBe(42);
      expect(redactSensitive(null)).toBeNull();
      expect(redactSensitive(undefined)).toBeUndefined();
    });

    it('Error не деконструируется (stack/message сохраняются для логгера)', () => {
      const err = new Error('boom');
      expect(redactSensitive(err)).toBe(err);
    });

    it('циклические ссылки не зависают', () => {
      const a: Record<string, unknown> = { token: 'T' };
      a.self = a;
      const out = redactSensitive(a) as Record<string, unknown>;
      expect(out.token).toBe(REDACTED);
      // self-ссылка не падает в бесконечную рекурсию (вернётся исходный объект)
      expect(out.self).toBeDefined();
    });

    it('не мутирует исходный объект (возвращает копию)', () => {
      const input = { password: 'p' };
      redactSensitive(input);
      expect(input.password).toBe('p');
    });
  });
});
