import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { VaultRepository } from '~/domain/vault/repositories/vault.repository';
import { VaultDomainEntity } from '~/domain/vault/entities/vault-domain.entity';
import { wifPermissions } from '~/domain/vault/types/vault.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Зашифрованные ключи подписи узла (таблица `vaults`). */
@Injectable()
export class VaultKyselyRepository implements VaultRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async getWif(username: string, permission: wifPermissions = wifPermissions.Active): Promise<string | null> {
    const row = await this.db
      .selectFrom('vaults')
      .select('wif')
      .where('username', '=', username)
      .where('permission', '=', permission)
      .executeTakeFirst();
    return row ? row.wif : null;
  }

  async setWif(username: string, wif: string, permission: wifPermissions = wifPermissions.Active): Promise<boolean> {
    const row = await this.db
      .insertInto('vaults')
      .values({ username, permission, wif })
      .onConflict((conflict) => conflict.columns(['username', 'permission']).doUpdateSet({ wif, updated_at: sql`now()` }))
      .returning('id')
      .executeTakeFirst();
    return !!row;
  }

  async findByUsernameAndPermission(username: string, permission: wifPermissions): Promise<VaultDomainEntity | null> {
    const row = await this.db
      .selectFrom('vaults')
      .selectAll()
      .where('username', '=', username)
      .where('permission', '=', permission)
      .executeTakeFirst();
    if (!row) return null;
    return new VaultDomainEntity(row.id, row.username, row.permission as wifPermissions, row.wif, row.created_at, row.updated_at);
  }
}
