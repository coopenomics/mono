import { Inject, Injectable } from '@nestjs/common';
import type { MeetRepository } from '~/domain/meet/repositories/meet-pre.repository';
import { MeetPreProcessingDomainEntity } from '~/domain/meet/entities/meet-pre-domain.entity';
import type { MeetPreProcessingDomainInterface } from '~/domain/meet/interfaces/meet-pre-domain.interface';
import { KYSELY, type Database } from '../kysely.tokens';

/** Собрание до обработки цепью: повестка и предложение, как их подал инициатор (таблица `meet_pre`). */
@Injectable()
export class MeetPreKyselyRepository implements MeetRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findByHash(hash: string): Promise<MeetPreProcessingDomainEntity | null> {
    const row = await this.db.selectFrom('meet_pre').selectAll().where('hash', '=', hash.toUpperCase()).executeTakeFirst();
    if (!row) return null;
    return new MeetPreProcessingDomainEntity({
      hash: row.hash,
      coopname: row.coopname,
      initiator: row.initiator,
      presider: row.presider,
      secretary: row.secretary,
      agenda: row.agenda as unknown as MeetPreProcessingDomainInterface['agenda'],
      open_at: row.open_at,
      close_at: row.close_at,
      proposal: (row.proposal ?? undefined) as unknown as MeetPreProcessingDomainInterface['proposal'],
      details: row.details ?? null,
    });
  }

  async create(data: MeetPreProcessingDomainEntity): Promise<void> {
    const values = {
      hash: data.hash.toUpperCase(),
      coopname: data.coopname,
      initiator: data.initiator,
      presider: data.presider,
      secretary: data.secretary,
      agenda: JSON.stringify(data.agenda),
      open_at: data.open_at,
      close_at: data.close_at,
      proposal: data.proposal == null ? null : JSON.stringify(data.proposal),
      details: data.details ?? null,
    };
    // Повторное создание собрания с тем же хешем перезаписывает запись, как и прежде.
    await this.db
      .insertInto('meet_pre')
      .values(values)
      .onConflict((conflict) => conflict.column('hash').doUpdateSet(values))
      .execute();
  }

  async deleteByHash(hash: string): Promise<void> {
    await this.db.deleteFrom('meet_pre').where('hash', '=', hash.toUpperCase()).execute();
  }
}
