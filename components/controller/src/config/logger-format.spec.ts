import { Writable } from 'stream';
import winston from 'winston';
import { buildLogFormat } from './logger';

/**
 * Story 9.12: проверяем обе ветки buildLogFormat — production JSON и dev pretty —
 * на реальном winston-логгере (через временный Stream-транспорт), включая инвариант
 * 8.7/8.8: секреты замаскированы и в структурированном JSON, и в pretty-выводе.
 */
function captureWith(format: winston.Logform.Format, fn: (l: winston.Logger) => void): string {
  let buffer = '';
  const sink = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString();
      cb();
    },
  });
  const logger = winston.createLogger({
    level: 'debug',
    format,
    transports: [new winston.transports.Stream({ stream: sink })],
  });
  fn(logger);
  return buffer;
}

describe('buildLogFormat — структурированные логи (Story 9.12)', () => {
  describe('production: JSON', () => {
    it('строка — валидный JSON с полями service/level/message/metadata', () => {
      const out = captureWith(buildLogFormat(true), (l) =>
        l.info('login attempt', { request_id: 'r-1', username: 'alice' }),
      ).trim();

      const parsed = JSON.parse(out);
      expect(parsed.service).toBe('coopback');
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('login attempt');
      expect(parsed.request_id).toBe('r-1');
      expect(parsed.username).toBe('alice');
      expect(parsed.timestamp).toBeDefined();
    });

    it('маскирует секреты в JSON-выводе (redaction 8.7 до сериализации)', () => {
      const out = captureWith(buildLogFormat(true), (l) =>
        l.info('login attempt', { password: 'super-secret-1', vault: { privateKey: 'pk-2' }, username: 'alice' }),
      ).trim();

      const parsed = JSON.parse(out);
      expect(parsed.password).toBe('[REDACTED]');
      expect(parsed.vault.privateKey).toBe('[REDACTED]');
      expect(parsed.username).toBe('alice');
      expect(out).not.toContain('super-secret-1');
      expect(out).not.toContain('pk-2');
    });

    it('уровень в JSON — без ANSI-кодов (нет colorize в prod-ветке)', () => {
      const out = captureWith(buildLogFormat(true), (l) => l.error('boom')).trim();
      const parsed = JSON.parse(out);
      expect(parsed.level).toBe('error');
      // ESC (код 27) — признак ANSI-раскраски; в prod-JSON его быть не должно
      expect(out).not.toContain(String.fromCharCode(27));
    });
  });

  describe('development: pretty', () => {
    it('вывод — НЕ JSON, человекочитаемая строка', () => {
      const out = captureWith(buildLogFormat(false), (l) => l.info('hello')).trim();
      expect(() => JSON.parse(out)).toThrow();
      expect(out).toContain('hello');
      // нет служебного поля service в pretty-строке
      expect(out).not.toContain('"service"');
    });

    it('маскирует секреты и в pretty-выводе', () => {
      const out = captureWith(buildLogFormat(false), (l) =>
        l.info('login', { token: 'tok-secret-9', username: 'bob' }),
      ).trim();
      expect(out).toContain('[REDACTED]');
      expect(out).not.toContain('tok-secret-9');
      expect(out).toContain('bob');
    });
  });
});
