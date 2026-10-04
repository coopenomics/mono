import { Inject, Injectable } from '@nestjs/common';
import type { MeetProcessedRepository } from '~/domain/meet/repositories/meet-processed.repository';
import { MeetProcessedDomainEntity } from '~/domain/meet/entities/meet-processed-domain.entity';
import { KYSELY, type Database } from '../kysely.tokens';

type Processed = ConstructorParameters<typeof MeetProcessedDomainEntity>[0];

/** Итоги собрания после решения: результаты по вопросам, кворум, документ решения (таблица `meet_processed`). */
@Injectable()
export class MeetProcessedKyselyRepository implements MeetProcessedRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findByHash(hash: string): Promise<MeetProcessedDomainEntity | null> {
    const row = await this.db
      .selectFrom('meet_processed')
      .selectAll()
      .where('hash', '=', hash.toUpperCase())
      .executeTakeFirst();
    if (!row) return null;
    return new MeetProcessedDomainEntity({
      hash: row.hash,
      // Колонка исторически jsonb: имя кооператива лежит в ней строкой JSON.
      coopname: row.coopname as unknown as Processed['coopname'],
      presider: row.presider,
      secretary: row.secretary,
      results: row.results as unknown as Processed['results'],
      signed_ballots: row.signed_ballots,
      quorum_percent: row.quorum_percent,
      quorum_passed: row.quorum_passed,
      decision: row.decision as unknown as Processed['decision'],
    });
  }

  async save(data: MeetProcessedDomainEntity): Promise<void> {
    const values = {
      hash: data.hash.toUpperCase(),
      coopname: JSON.stringify(data.coopname),
      presider: data.presider,
      secretary: data.secretary,
      results: JSON.stringify(data.results),
      signed_ballots: data.signed_ballots,
      quorum_percent: data.quorum_percent,
      quorum_passed: data.quorum_passed,
      decision: JSON.stringify(data.decision),
    };
    await this.db
      .insertInto('meet_processed')
      .values(values)
      .onConflict((conflict) => conflict.column('hash').doUpdateSet(values))
      .execute();
  }
}
