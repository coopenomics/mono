import { Inject, Injectable } from '@nestjs/common';
import type { IVaultPort } from '@coopenomics/innercoop';
import { InnerKeyPermission } from '@coopenomics/innercoop';
import { VAULT_DOMAIN_SERVICE, type VaultDomainService } from '~/domain/vault/services/vault-domain.service';
import { wifPermissions } from '~/domain/vault/types/vault.types';

/**
 * Реализация `IVaultPort`: расшифровка ключа остаётся в ядре, наружу уходит
 * только сам ключ и только тому, кто его спросил.
 */
/**
 * Уровни полномочий контракта и ядра — два разных перечня с одинаковыми
 * значениями. Соответствие задано явно: молчаливое приведение сломалось бы
 * при добавлении уровня только в один из них.
 */
const PERMISSION_IN_CORE: Record<InnerKeyPermission, wifPermissions> = {
  [InnerKeyPermission.ACTIVE]: wifPermissions.Active,
};

@Injectable()
export class VaultInnercoopAdapter implements IVaultPort {
  constructor(
    @Inject(VAULT_DOMAIN_SERVICE)
    private readonly vaultDomainService: VaultDomainService
  ) {}

  async getWif(username: string, permission: InnerKeyPermission = InnerKeyPermission.ACTIVE): Promise<string | null> {
    return this.vaultDomainService.getWif(username, PERMISSION_IN_CORE[permission]);
  }
}
