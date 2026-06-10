/**
 * @fileoverview Клиент signed-request поверхности CA-auth (Story 2.2 на их
 * стороне). Подписывает HTTP-запросы приватным ключом кооператива в том же
 * каноне, который проверяет `SignedRequestMiddleware` ca-auth:
 *
 *   canonical = UPPERCASE(method) \n path \n body \n timestamp \n nonce
 *   подпись   = ECDSA secp256k1 (canonical recoverable) над SHA256(canonical)
 *   заголовок = `X-Signature: k1:<base58(r||s||recoveryId)>`
 *             + X-Coopname / X-Timestamp (ISO-8601) / X-Nonce (UUIDv4)
 *
 * Канон зафиксирован контрактом (apps-catalog libs/shared/src/auth/
 * canonicalize.ts + k1-signature.parser.ts) — менять только синхронно.
 */
import { createHash, randomUUID } from 'crypto';
import { ec as EC } from 'elliptic';
import bs58 from 'bs58';

const secp256k1 = new EC('secp256k1');

/** WIF (base58check, version 0x80) → 32 байта приватного ключа. */
export function wifToPrivateKey(wif: string): Buffer {
  const decoded = bs58.decode(wif.trim());
  if (decoded.length < 37) {
    throw new Error('WIF слишком короткий');
  }
  const payload = decoded.subarray(0, decoded.length - 4);
  const checksum = decoded.subarray(decoded.length - 4);
  const expected = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest()
    .subarray(0, 4);
  if (!checksum.equals(expected)) {
    throw new Error('WIF: неверная контрольная сумма');
  }
  if (payload[0] !== 0x80) {
    throw new Error('WIF: неожиданный version-байт');
  }
  // 33 байта payload = version + key; 34 = version + key + compression-флаг.
  return Buffer.from(payload.subarray(1, 33));
}

export interface SignedHeaders {
  'X-Signature': string;
  'X-Coopname': string;
  'X-Timestamp': string;
  'X-Nonce': string;
}

export class SignedRequestSigner {
  private readonly privateKey: Buffer;

  constructor(
    private readonly coopname: string,
    wif: string,
  ) {
    this.privateKey = wifToPrivateKey(wif);
  }

  /**
   * Заголовки подписи для запроса. `path` — полный originalUrl с query,
   * `body` — точная raw-строка тела ('' для GET/POST без тела).
   */
  sign(method: string, path: string, body = ''): SignedHeaders {
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const canonical = [method.toUpperCase(), path, body, timestamp, nonce].join('\n');
    const hash = createHash('sha256').update(canonical, 'utf8').digest();

    const key = secp256k1.keyFromPrivate(this.privateKey);
    const sig = key.sign(hash, { canonical: true });
    const r = sig.r.toArrayLike(Buffer, 'be', 32);
    const s = sig.s.toArrayLike(Buffer, 'be', 32);
    const recovery = sig.recoveryParam ?? 0;

    const packed = Buffer.concat([r, s, Buffer.from([recovery])]);
    return {
      'X-Signature': `k1:${bs58.encode(packed)}`,
      'X-Coopname': this.coopname,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
    };
  }
}
