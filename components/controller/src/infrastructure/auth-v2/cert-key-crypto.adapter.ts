import { createPrivateKey, type KeyObject } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Bytes, KeyType, PrivateKey, PublicKey } from '@wharfkit/antelope';
import type { ICertKeyCrypto } from '~/domain/auth-v2/ports/cert-key-crypto.port';

/**
 * Криптография ключа заверения на библиотеке цепи. Здесь же — единственный в
 * контроллере переход между двумя представлениями одного и того же ключа: формат
 * цепи (`PVT_K1_…`) и PEM, которым его заводят секретом поставки.
 */
@Injectable()
export class CertKeyCryptoAdapter implements ICertKeyCrypto {
  generate(): string {
    return PrivateKey.generate(KeyType.K1).toWif();
  }

  publicKeyOf(privateKey: string): string {
    return PrivateKey.fromString(privateKey).toPublic().toString();
  }

  publicKeyOfPem(pem: string): string {
    return this.publicKeyOf(this.pemToChainKey(pem));
  }

  pemToChainKey(pem: string): string {
    const jwk = createPrivateKey(pem).export({ format: 'jwk' }) as { d?: string };
    if (!jwk.d) throw new Error('Ключ заверения не содержит приватной части');
    return new PrivateKey(KeyType.K1, Bytes.from(Buffer.from(jwk.d, 'base64url'))).toWif();
  }

  /**
   * Ключ цепи хранит «сырые» 32 байта, а Node принимает только упакованный ключ,
   * поэтому байты заворачиваются в стандартную оболочку SEC1 для secp256k1 —
   * другого пути от одного представления к другому нет.
   */
  toSigningKey(privateKey: string): KeyObject {
    const d = Buffer.from(PrivateKey.fromString(privateKey).data.array);
    const der = Buffer.concat([
      Buffer.from([0x30, 0x2e, 0x02, 0x01, 0x01, 0x04, 0x20]),
      d,
      Buffer.from([0xa0, 0x07, 0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a]),
    ]);
    return createPrivateKey({ key: der, format: 'der', type: 'sec1' });
  }

  signChainMessage(privateKey: string, message: Uint8Array): string {
    return PrivateKey.fromString(privateKey).signMessage(message).toString();
  }

  normalizePublicKey(publicKey: string): string {
    try {
      return PublicKey.from(publicKey).toString();
    } catch {
      return publicKey;
    }
  }
}
