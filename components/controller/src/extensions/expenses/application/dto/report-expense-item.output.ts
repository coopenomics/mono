import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';

/**
 * Исход отчёта пайщика по строке-авансу: совпал ли факт с выданным авансом или
 * требуется расчёт разницы через платёжку.
 */
export enum ExpenseReportOutcome {
  /** Факт равен авансу — позиция закрыта on-chain (`expense::reportexp`). */
  CLOSED = 'CLOSED',
  /** Недорасход — заведена входящая платёжка возврата разницы, ждёт приёма кассиром. */
  RETURN_PENDING = 'RETURN_PENDING',
  /** Перерасход — заведена исходящая платёжка-доплата разницы, ждёт выплаты кассиром. */
  OVERSPEND_PENDING = 'OVERSPEND_PENDING',
}

registerEnumType(ExpenseReportOutcome, {
  name: 'ExpenseReportOutcome',
  description: 'Исход отчёта по строке-авансу: закрыто либо ожидается расчёт разницы (возврат/доплата).',
});

/**
 * Результат мутации `reportExpenseItem`.
 *
 * При `CLOSED` заполнен `transaction` (on-chain reportexp). При `RETURN_PENDING` /
 * `OVERSPEND_PENDING` chain-транзакции ещё нет — заполнены `settlement_amount`
 * (раз­ница) и `settlement_payment_hash` (хэш заведённой платёжки расчёта);
 * `reportexp` пройдёт автоматически после подтверждения платёжки кассиром.
 */
@ObjectType('ExpenseReportResult')
export class ExpenseReportResultDTO {
  @Field(() => ExpenseReportOutcome, { description: 'Исход отчёта.' })
  outcome!: ExpenseReportOutcome;

  @Field(() => TransactionDTO, { nullable: true, description: 'Транзакция закрытия позиции (только при CLOSED).' })
  transaction?: TransactionDTO;

  @Field(() => String, { nullable: true, description: 'Сумма разницы к расчёту (asset), при недо-/перерасходе.' })
  settlement_amount?: string;

  @Field(() => String, { nullable: true, description: 'Хэш заведённой платёжки расчёта (возврат/доплата).' })
  settlement_payment_hash?: string;
}
