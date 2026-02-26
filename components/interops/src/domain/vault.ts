/**
 * Порты хранилища ключей
 */

export interface IVaultDomainService {
  getWif(username: string): Promise<string | null>;
}

export const VAULT_DOMAIN_SERVICE = Symbol('VaultDomainService');
