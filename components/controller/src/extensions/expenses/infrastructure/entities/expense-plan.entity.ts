import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExpensePlanPriority } from '../../domain/expense-plan.types';

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
@Entity('expense_plans')
@Index('idx_expense_plans_coop_branch', ['coopname', 'braname'])
export class ExpensePlanEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'coopname', type: 'varchar', length: 13 })
  coopname!: string;

  @Column({
    name: 'braname',
    type: 'varchar',
    length: 13,
    nullable: true,
    comment: 'Кооперативный участок; NULL — расход уровня кооператива',
  })
  braname?: string | null;

  @Column({ name: 'title', type: 'varchar', length: 500, comment: 'Назначение расхода' })
  title!: string;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 20,
    scale: 4,
    comment: 'Сумма расхода в валюте кооператива',
  })
  amount!: string;

  @Column({
    name: 'due_date',
    type: 'timestamptz',
    nullable: true,
    comment: 'Срок оплаты; NULL для срочных («как только возможно») и необязательных',
  })
  dueDate?: Date | null;

  @Column({
    name: 'priority',
    type: 'varchar',
    length: 16,
    comment: 'SCHEDULED — к дате; URGENT — как только возможно (всегда в резерве); OPTIONAL — при наличии средств (не в резерве)',
  })
  priority!: ExpensePlanPriority;

  @Column({
    name: 'pay_to',
    type: 'varchar',
    length: 1000,
    comment: 'Реквизиты получателя платежа (строкой — передаётся в платёжку кассиру)',
  })
  payTo!: string;

  @Column({ name: 'creator', type: 'varchar', length: 13, comment: 'Кто добавил запись' })
  creator!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
