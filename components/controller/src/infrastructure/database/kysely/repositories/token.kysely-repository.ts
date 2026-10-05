import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import type { TokenRepository } from '~/domain/token/repositories/token.repository';
import type { TokenDomainInterface } from '~/domain/token/interfaces/token-domain.interface';
import type { CreateTokenInputDomainInterface } from '~/domain/token/interfaces/create-token-input-domain.interface';
import { TokenDomainEntity } from '~/domain/token/entities/token-domain.entity';
import type { TokenType } from '~/types/token.types';
import type { Tokens } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

function toDomain(row: Selectable<Tokens>): TokenDomainInterface {
  return new TokenDomainEntity(
    row.token,
    row.user_id,
    row.type as any,
    row.expires,
    row.blacklisted,
    row.created_at,
    row.updated_at,
    row.id
  );
}

/** Токены сессий и подтверждений (таблица `tokens`). */
@Injectable()
export class TokenKyselyRepository implements TokenRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(tokenData: CreateTokenInputDomainInterface): Promise<TokenDomainInterface> {
    const row = await this.db
      .insertInto('tokens')
      .values({
        token: tokenData.token,
        user_id: tokenData.userId,
        type: tokenData.type,
        expires: tokenData.expires,
        blacklisted: tokenData.blacklisted || false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findByTokenAndTypes(token: string, types: TokenType[]): Promise<TokenDomainInterface | null> {
    if (types.length === 0) return null;
    const row = await this.db
      .selectFrom('tokens')
      .selectAll()
      .where('token', '=', token)
      .where('type', 'in', types)
      .where('blacklisted', '=', false)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByUserIdAndType(userId: string, type: TokenType): Promise<TokenDomainInterface[]> {
    const rows = await this.db
      .selectFrom('tokens')
      .selectAll()
      .where('user_id', '=', userId)
      .where('type', '=', type)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<TokenDomainInterface | null> {
    const row = await this.db.selectFrom('tokens').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.db.deleteFrom('tokens').where('id', '=', id).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0) > 0;
  }

  async deleteMany(criteria: Partial<TokenDomainInterface>): Promise<number> {
    let query = this.db.deleteFrom('tokens');
    if (criteria.id !== undefined) query = query.where('id', '=', criteria.id);
    if (criteria.token !== undefined) query = query.where('token', '=', criteria.token);
    if (criteria.userId !== undefined) query = query.where('user_id', '=', criteria.userId);
    if (criteria.type !== undefined) query = query.where('type', '=', criteria.type);
    if (criteria.blacklisted !== undefined) query = query.where('blacklisted', '=', criteria.blacklisted);
    const result = await query.executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }

  async updateById(id: string, updates: Partial<TokenDomainInterface>): Promise<TokenDomainInterface | null> {
    const row = await this.db
      .updateTable('tokens')
      .set({
        ...(updates.token !== undefined ? { token: updates.token } : {}),
        ...(updates.userId !== undefined ? { user_id: updates.userId } : {}),
        ...(updates.type !== undefined ? { type: updates.type } : {}),
        ...(updates.expires !== undefined ? { expires: updates.expires } : {}),
        ...(updates.blacklisted !== undefined ? { blacklisted: updates.blacklisted } : {}),
        updated_at: updates.updatedAt !== undefined ? updates.updatedAt : sql`now()`,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findOneAndDelete(token: string, type: TokenType): Promise<TokenDomainInterface | null> {
    const row = await this.db
      .deleteFrom('tokens')
      .where('token', '=', token)
      .where('type', '=', type)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
