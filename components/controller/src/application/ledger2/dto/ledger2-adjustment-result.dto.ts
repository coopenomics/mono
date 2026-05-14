import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Результат мутаций `walmoveWallets` / `revertOperation`.
 *
 * `processHash` — общий якорь для всех записей корректировки в
 * `blockchain_actions` (action + inline walletop + опц. debit/credit).
 * UI использует его для немедленного перехода в реестр операций
 * с фильтром по этому хэшу.
 *
 * `transactionId` — id транзакции в чейне для трассировки.
 */
@ObjectType('Ledger2AdjustmentResult')
export class Ledger2AdjustmentResultDTO {
  @Field(() => String)
  processHash!: string;

  @Field(() => String)
  transactionId!: string;
}
