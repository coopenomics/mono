import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import type { PaymentStateRepository, IPaymentState } from '~/domain/gateway/repositories/payment-state.repository';
import { KYSELY, type Database } from '../kysely.tokens';

/** Состояние опроса выписок платёжного провайдера (таблица `payment_state`). */
@Injectable()
export class PaymentStateKyselyRepository implements PaymentStateRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findOne(accountNumber: string, statementDate: string): Promise<IPaymentState | null> {
    const row = await this.db
      .selectFrom('payment_state')
      .select(['accountNumber', 'statementDate', 'lastProcessedPage'])
      .where('accountNumber', '=', accountNumber)
      .where('statementDate', '=', statementDate)
      .executeTakeFirst();
    return row ?? null;
  }

  async save(data: IPaymentState): Promise<IPaymentState> {
    const row = await this.db
      .insertInto('payment_state')
      .values({
        accountNumber: data.accountNumber,
        statementDate: data.statementDate,
        lastProcessedPage: data.lastProcessedPage,
      })
      .onConflict((conflict) =>
        conflict
          .columns(['accountNumber', 'statementDate'])
          .doUpdateSet({ lastProcessedPage: data.lastProcessedPage, updated_at: sql`now()` })
      )
      .returning(['accountNumber', 'statementDate', 'lastProcessedPage'])
      .executeTakeFirstOrThrow();
    return row;
  }
}
