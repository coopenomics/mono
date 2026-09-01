import { Inject, Injectable } from '@nestjs/common';
import { VaultServerDecryptionForbiddenError } from '~/domain/auth-v2/errors/auth-v2.error';
import { VAULT_REPOSITORY } from '~/domain/auth-v2/vault/vault-repository.port';
import type { IVaultRepository } from '~/domain/auth-v2/vault/vault-repository.port';
import type { EncryptedVaultBlob, RetrieveVaultInput, VaultSubject } from '~/domain/auth-v2/vault/vault.types';

/**
 * Серверная сторона vault (CoopID, Story 2.1). Хранит и отдаёт ТОЛЬКО
 * зашифрованный блоб. Расшифровка ключа пайщика на сервере невозможна:
 * `RetrieveVaultInput` для participant не несёт секрета (type-ban), а
 * `assertNoServerDecrypt` страхует в рантайме.
 */
@Injectable()
export class VaultService {
  constructor(@Inject(VAULT_REPOSITORY) private readonly repo: IVaultRepository) {}

  async store(subject: VaultSubject, blob: EncryptedVaultBlob): Promise<void> {
    await this.repo.upsert(subject, blob);
  }

  /** Возвращает зашифрованный блоб субъекта (расшифровка — только на клиенте). */
  async retrieve(input: RetrieveVaultInput): Promise<EncryptedVaultBlob | null> {
    return this.repo.find({ subject_type: input.subject_type, subject_id: input.subject_id });
  }

  /**
   * Намеренно нереализуемый метод-маркер: любая попытка серверной расшифровки
   * ключа участника обязана пройти сюда и упасть. Существует, чтобы инвариант
   * был виден в коде и тестах, а не только в отсутствии метода.
   */
  assertNoServerDecrypt(): never {
    throw new VaultServerDecryptionForbiddenError();
  }
}
