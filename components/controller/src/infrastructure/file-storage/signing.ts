import { createHmac, timingSafeEqual } from 'crypto';

/**
 * HMAC-SHA256(secret, "<bucket>\n<key>\n<exp>") в hex.
 * Используется и адаптером (выдача URL), и HTTP-ручкой (валидация).
 */
export function signReadUrl(args: {
  bucket: string;
  key: string;
  expUnix: number;
  secret: string;
}): string {
  const h = createHmac('sha256', args.secret);
  h.update(`${args.bucket}\n${args.key}\n${args.expUnix}`);
  return h.digest('hex');
}

/**
 * Constant-time сверка подписи. Возвращает false на любую структурную ошибку
 * (несовпадение длин, не-hex), а не выбрасывает — чтобы не различать каналы side-channel-ом.
 */
export function verifyReadUrl(args: {
  bucket: string;
  key: string;
  expUnix: number;
  sig: string;
  secret: string;
}): boolean {
  const expected = signReadUrl(args);
  if (expected.length !== args.sig.length) return false;
  let expectedBuf: Buffer;
  let actualBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, 'hex');
    actualBuf = Buffer.from(args.sig, 'hex');
  } catch {
    return false;
  }
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
