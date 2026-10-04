import { ExpensePlanRecurrence } from '../../domain/expense-plan.types';

/**
 * TypeORM-сущность `expense_plans` — общесистемный оффчейн-реестр плановых
 * расходов кооператива (requirement b6 «Экономика КУ», раунд 5).
 *
 * Решение владельца 2026-06-10: расходы относятся к кооперативу, а не к
 * Столу заказов — реестр живёт в общесистемном расширении `expenses` (то же
 * место, куда позже встанет шасси расходов; план-записи совместятся с его
 * proposals). Записи привязаны к кооперативу и опционально к кооперативному
 * участку (braname NULL — расход уровня кооператива). Бэкенд считает
 * 30-дневный резерв; потребители (например, распределение членских взносов
 * КУ в marketplace) сверяются с резервом перед использованием средств.
 *
 * Off-chain, DDL через `synchronize` (default-connection). Удаление плана —
 * физическое: реестр черновой, оплат через него пока нет, история движений
 * живёт в ledger2.
 */
export class ExpensePlanEntity {
  id!: number;

  coopname!: string;

  braname?: string | null;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  title!: string;

  amount!: string;

  dueDate?: Date | null;

  recurrence!: ExpensePlanRecurrence;

  nextSpawned!: boolean;

  proposalHash?: string | null;

  paidAt?: Date | null;

  payTo!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  creator!: string;

  createdAt!: Date;

  updatedAt!: Date;
}
