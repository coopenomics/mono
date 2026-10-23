/**
 * @fileoverview Клиент signed-request поверхности catalog-delivery (Story 2.2 на их
 * стороне). Подписывает HTTP-запросы приватным ключом кооператива в том же
 * каноне, который проверяет `SignedRequestMiddleware` catalog-delivery:
 *
 *   canonical = UPPERCASE(method) \n path \n body \n timestamp \n nonce
 *   подпись   = ECDSA secp256k1 (canonical recoverable) над SHA256(canonical)
 *   заголовок = `X-Signature: k1:<base58(r||s||recoveryId)>`
 *             + X-Coopname / X-Timestamp (ISO-8601) / X-Nonce (UUIDv4)
 *
 * Канон зафиксирован контрактом (apps-catalog libs/shared/src/auth/
 * canonicalize.ts + k1-signature.parser.ts) — менять только синхронно.
 */
import { Logger } from '@nestjs/common';
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

/** Открытый ключ цепи (`EOS…` или `PUB_K1_…`) → 33 байта сжатой точки; иные типы — null. */
function chainPublicKeyBytes(key: string): Buffer | null {
  const body = key.startsWith('PUB_K1_') ? key.slice(7) : key.startsWith('EOS') ? key.slice(3) : null;
  if (body === null) return null;
  return Buffer.from(bs58.decode(body).subarray(0, 33));
}

/**
 * Ключ подписи каталога из `CATALOG_SIGNING_KEY`; `null`, если не задан.
 *
 * Каталог сверяет подпись с `apps::coops.signing_key` — ключом, отдельным от
 * разрешений аккаунта кооператива, поэтому его допустимо держать в окружении:
 * утечка даёт только вход в каталог и закрывается сменой ключа (`setcoop`).
 * Если в переменную положили ключ разрешения аккаунта (`active`, `owner`),
 * открытая копия позволила бы подписывать транзакции кооператива — такой
 * ключ отклоняется. Без адреса цепи сверка пропускается.
 */
export async function loadCatalogSigningKey(
  rpcUrl: string | undefined,
  coopname: string,
): Promise<string | null> {
  const signingKey = process.env.CATALOG_SIGNING_KEY;
  if (!signingKey) return null;
  if (!rpcUrl) return signingKey;
  const res = await fetch(`${rpcUrl}/v1/chain/get_account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_name: coopname }),
  });
  if (!res.ok) {
    throw new Error(`проверка ключа подписи каталога: get_account ${coopname} → HTTP ${res.status}`);
  }
  const account = (await res.json()) as {
    permissions?: { perm_name: string; required_auth?: { keys?: { key: string }[] } }[];
  };
  const signingPublic = Buffer.from(
    secp256k1.keyFromPrivate(wifToPrivateKey(signingKey)).getPublic(true, 'array'),
  );
  for (const permission of account.permissions ?? []) {
    for (const { key } of permission.required_auth?.keys ?? []) {
      if (chainPublicKeyBytes(key)?.equals(signingPublic)) {
        throw new Error(
          `CATALOG_SIGNING_KEY совпадает с ключом разрешения ${permission.perm_name} аккаунта ${coopname}: ` +
            'заведите отдельный ключ и зарегистрируйте его в каталоге действием setcoop',
        );
      }
    }
  }
  return signingKey;
}

/**
 * {@link loadCatalogSigningKey} для фабрик модулей: адрес цепи из
 * `CHAIN_RPC_URL`, отказ проверки пишется в журнал, и модуль работает без
 * каталога — неверный ключ не роняет шлюз.
 */
export async function catalogSigningKeyOrNull(coopname: string): Promise<string | null> {
  try {
    return await loadCatalogSigningKey(process.env.CHAIN_RPC_URL, coopname);
  } catch (err) {
    new Logger('CatalogSigningKey').error(err instanceof Error ? err.message : String(err));
    return null;
  }
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
