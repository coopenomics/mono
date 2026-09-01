import { Writable } from 'stream';
import winston from 'winston';
import logger from './logger';
import { assertNoSensitiveLeaks, findSensitiveLeaks } from './log-purity';

/**
 * Story 8.8 — захватывает вывод РЕАЛЬНОГО боевого logger (с цепочкой форматов 8.7)
 * через временный winston-Stream-транспорт и проверяет, что секреты не утекают.
 * Stream-транспорт пишет в рамках вызова logger.* — детерминированно, без async-
 * флака Console-транспорта и без перехвата process.stdout.
 */
function captureLoggerOutput(fn: () => void): string {
  let buffer = '';
  const sink = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString();
      cb();
    },
  });
  const transport = new winston.transports.Stream({ stream: sink });
  logger.add(transport);
  try {
    fn();
  } finally {
    logger.remove(transport);
  }
  return buffer;
}

describe('log-purity — чистота логов (Story 8.8)', () => {
  describe('боевой logger маскирует секреты (интеграция с 8.7)', () => {
    it('секрет под секрет-ключами → [REDACTED], исходных значений в выводе нет', () => {
      const password = 'test-password-INTEGR-1';
      const privateKey = 'private-key-INTEGR-2';
      const accessToken = 'secret-INTEGR-3';
      const out = captureLoggerOutput(() => {
        logger.info('login attempt', { password, vault: { privateKey }, accessToken, username: 'alice' });
      });
      expect(out).toContain('[REDACTED]');
      expect(out).toContain('alice'); // несекретное поле проходит
      // ни одно из секрет-значений не утекло
      assertNoSensitiveLeaks(out, [password, privateKey, accessToken]);
    });

    it('утечка значения под НЕсекретным ключом ловится сканером (то, что 8.7 пропускает)', () => {
      // key 'note' не секретный → 8.7 не маскирует значение; 8.8 ловит по содержимому
      const out = captureLoggerOutput(() => {
        logger.info('oops', { note: 'мой ключ wif-LEAK-9 случайно тут' });
      });
      const leaks = findSensitiveLeaks(out);
      expect(leaks.length).toBeGreaterThanOrEqual(1);
      expect(leaks[0].match).toContain('wif-LEAK-9');
    });
  });

  describe('findSensitiveLeaks / assertNoSensitiveLeaks (unit)', () => {
    it('находит тест-паттерн и репортит номер строки', () => {
      const output = 'строка ок\nтут утёк test-password-abc123\nещё строка';
      const leaks = findSensitiveLeaks(output);
      expect(leaks).toHaveLength(1);
      expect(leaks[0].line).toBe(2);
      expect(leaks[0].match).toBe('test-password-abc123');
    });

    it('находит точное значение фикстуры', () => {
      const output = 'a\nb содержит 5KQwrPbwdL6PhXuj секрет';
      const leaks = findSensitiveLeaks(output, ['5KQwrPbwdL6PhXuj']);
      expect(leaks).toHaveLength(1);
      expect(leaks[0].pattern).toBe('exact-fixture');
      expect(leaks[0].line).toBe(2);
    });

    it('чистый вывод → пустой список', () => {
      expect(findSensitiveLeaks('всё чисто\nникаких секретов\n[REDACTED]')).toEqual([]);
    });

    it('assertNoSensitiveLeaks бросает с сообщением «at line N»', () => {
      const output = 'ok\nok\nутечка secret-XYZ тут';
      expect(() => assertNoSensitiveLeaks(output)).toThrow(/Sensitive value leaked to logs at line 3/);
    });

    it('assertNoSensitiveLeaks на чистом выводе — no-op', () => {
      expect(() => assertNoSensitiveLeaks('чисто\n[REDACTED]')).not.toThrow();
    });
  });
});
