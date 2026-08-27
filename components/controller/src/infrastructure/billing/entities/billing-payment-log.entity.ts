import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Статус записи журнала биллинг-платежей (см. {@link BillingPaymentLogEntity}).
 */
export enum BillingPaymentLogStatus {
  /** Запись создана ДО transact; исход on-chain ещё неизвестен. */
  SUBMITTING = 'SUBMITTING',
  /** Транзакция принята нодой (есть tx_id), подтверждение провайдеру могло ещё не дойти. */
  SUBMITTED = 'SUBMITTED',
  /** Провайдер подтвердил (invoice PAID) — терминальный успех. */
  CONFIRMED = 'CONFIRMED',
  /** Нода отклонила транзакцию доменной ошибкой — повтор оплаты безопасен. */
  FAILED = 'FAILED',
}

/**
 * Журнал отправленных on-chain биллинг-платежей (`billing::pay`) на хабе.
 *
 * Источник идемпотентности рекуррентных списаний (решение @ant 2026-06-11:
 * платежи НЕ хранятся в RAM чейна — контракт без таблиц; дедуп живёт здесь,
 * в PG оператора, где хранение бесплатно). Запись создаётся ДО transact:
 * существующая запись с тем же `payment_hash` блокирует повторное списание
 * при любом сценарии (зависший парсер, упавший backend между transact и
 * callback провайдеру, наложение тиков).
 */
@Entity('billing_payment_log')
export class BillingPaymentLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Детерминированный идентификатор платежа из invoice провайдера. */
  @Column({ length: 64 })
  @Index('idx_billing_payment_log_hash', { unique: true })
  payment_hash!: string;

  /** Кооператив-пайщик, чей биллинг-кошелёк дебетуется. */
  @Column({ length: 12 })
  coopname!: string;

  /** Сумма списания с символом, например "1500.0000 RUB". */
  @Column({ length: 64 })
  quantity!: string;

  /**
   * За что списано — перечень услуг человеческим текстом («Хостинг на сервере»,
   * «Электронный документооборот»). Состав платежа знает только провайдер, а
   * летопись живёт здесь, поэтому имена сохраняются в момент списания: позже
   * восстановить их будет неоткуда (invoice протухает, тариф переименовывают).
   * Null у записей, заведённых до появления поля.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  subject!: string | null;

  @Column({ type: 'enum', enum: BillingPaymentLogStatus, default: BillingPaymentLogStatus.SUBMITTING })
  status!: BillingPaymentLogStatus;

  /** ID принятой транзакции (после SUBMITTED). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tx_id!: string | null;

  /** Текст последней ошибки (для FAILED и зависших SUBMITTING). */
  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  constructor(data?: Partial<BillingPaymentLogEntity>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}
