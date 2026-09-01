import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) для второго фактора CoopID — совместимо с Google Authenticator
 * (HMAC-SHA1, шаг 30с, 6 цифр, секрет в Base32 RFC 4648 без padding).
 *
 * Реализовано на `node:crypto` без внешних зависимостей: алгоритм компактный, а
 * добавлять npm-пакет ради ~40 строк в brownfield-монорепе (prune --prod, аудит
 * зависимостей) избыточно. Чистый домен — ни I/O, ни конфигов.
 */

const TOTP_STEP_SEC = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Случайный Base32-секрет (по умолчанию 20 байт = 160 бит, как рекомендует RFC 4226). */
export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

/** Декодировать Base32 (RFC 4648, регистронезависимо, padding/пробелы игнорируются). */
function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Невалидный символ Base32 в TOTP-секрете');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** Один HOTP-код (RFC 4226) для счётчика — основа TOTP. */
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-битный счётчик big-endian; хватает 53-битной точности number до ~285 млн лет.
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Проверить TOTP-код. `window` — допуск по соседним шагам в обе стороны (по умолчанию
 * ±1 = ±30с, компенсирует рассинхрон часов телефона). Сравнение постоянного времени.
 * `nowSec` инъектируется для тестов; по умолчанию — системное время.
 */
export function verifyTotp(secret: string, code: string, window = 1, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const counter = Math.floor(nowSec / TOTP_STEP_SEC);
  const expected = Buffer.from(code);
  for (let i = -window; i <= window; i++) {
    const candidate = Buffer.from(hotp(key, counter + i));
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

/** otpauth://-URI для QR-кода в приложении-аутентификаторе. */
export function buildOtpauthUri(secret: string, accountLabel: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
