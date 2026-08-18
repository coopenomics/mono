import { Injectable } from '@nestjs/common';
import type { ISecretCipherPort } from '@coopenomics/innercoop';
import { encrypt, decrypt } from '~/utils/aes';

/**
 * Реализация `ISecretCipherPort`: ключ кооператива и алгоритм остаются в ядре,
 * наружу уходят только две операции над строкой.
 */
@Injectable()
export class SecretCipherInnercoopAdapter implements ISecretCipherPort {
  encrypt(plaintext: string): string {
    return encrypt(plaintext);
  }

  decrypt(ciphertext: string): string {
    return decrypt(ciphertext);
  }
}
