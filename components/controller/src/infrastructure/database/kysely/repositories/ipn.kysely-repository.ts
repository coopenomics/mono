import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { IpnRepository, IIpn } from '~/domain/gateway/repositories/ipn.repository';
import { KYSELY, type Database } from '../kysely.tokens';

/** Журнал уведомлений платёжного провайдера (таблица `ipn`). */
@Injectable()
export class IpnKyselyRepository implements IpnRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findOne(criteria: Partial<IIpn>): Promise<IIpn | null> {
    let query = this.db.selectFrom('ipn').selectAll();
    if (criteria.provider) query = query.where('provider', '=', criteria.provider);
    // Уведомление ищется по номеру объекта внутри его тела.
    const objectId = (criteria.data as { object?: { id?: string } } | undefined)?.object?.id;
    if (objectId) query = query.where(sql<boolean>`data -> 'object' ->> 'id' = ${objectId}`);
    const row = await query.limit(1).executeTakeFirst();
    return row ? { ...row, data: row.data as object } : null;
  }

  async create(data: Omit<IIpn, 'id' | 'created_at' | 'updated_at'>): Promise<IIpn> {
    const row = await this.db
      .insertInto('ipn')
      .values({ provider: data.provider, data: JSON.stringify(data.data) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return { ...row, data: row.data as object };
  }
}
