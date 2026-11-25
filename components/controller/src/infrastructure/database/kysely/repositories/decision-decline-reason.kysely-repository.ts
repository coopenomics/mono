import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { IDecisionDeclineReasonPort } from '@coopenomics/innercoop';
import type { DecisionDeclineReasonRepository } from '~/domain/decision/repositories/decision-decline-reason.repository';
import { KYSELY, type Database } from '../kysely.tokens';

/**
 * Пояснения председателя к отклонению решений совета. Тот же класс — адаптер
 * порта DECISION_DECLINE_REASON_PORT: расширение читает пояснение по номеру
 * решения, когда получает обратный вызов отклонения.
 */
@Injectable()
export class DecisionDeclineReasonKyselyRepository implements DecisionDeclineReasonRepository, IDecisionDeclineReasonPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async save(coopname: string, decisionId: number, reason: string, declinedBy: string | null): Promise<void> {
    await this.db
      .insertInto('decision_decline_reasons')
      .values({ coopname, decision_id: decisionId, reason, declined_by: declinedBy })
      .onConflict((c) =>
        c.columns(['coopname', 'decision_id']).doUpdateSet({ reason, declined_by: declinedBy, created_at: sql`now()` })
      )
      .execute();
  }

  async remove(coopname: string, decisionId: number): Promise<void> {
    await this.db
      .deleteFrom('decision_decline_reasons')
      .where('coopname', '=', coopname)
      // bigint Kysely сравнивает строкой
      .where('decision_id', '=', String(decisionId))
      .execute();
  }

  async find(coopname: string, decisionId: string | number): Promise<string | null> {
    const row = await this.db
      .selectFrom('decision_decline_reasons')
      .select('reason')
      .where('coopname', '=', coopname)
      .where('decision_id', '=', String(decisionId))
      .executeTakeFirst();
    return row?.reason ?? null;
  }

  getDeclineReason(coopname: string, decisionId: string | number): Promise<string | null> {
    return this.find(coopname, decisionId);
  }
}
