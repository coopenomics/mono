import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Ручные реквизиты кооператива для отчётности ФНС/СФР.
 *
 * Хранятся поля, которых нет в профиле организации (`IOrganizationData` в
 * основной БД кооператива): ОКВЭД, ОКФС, ОКОПФ, ОКТМО, ОКПО, регномер СФР,
 * регномер ПФР (для ЕФС-1 — отдельный от regномера СФР, см. patterns.ts),
 * должность руководителя, СНИЛС подписанта, описание доверенности. Плюс
 * возможные override'ы телефона и адреса (если в отчётности нужен не тот,
 * что в профиле организации).
 *
 * Строка одна на кооператив; PK — `coopname`.
 */
@Entity('report_requisites')
export class ReportRequisitesEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  okved?: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  okfs?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  okopf?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  oktmo?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  okpo?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  sfr_reg_number?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  pfr_reg_number?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chairman_position?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  signer_snils?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  signer_rep_doc?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  signer_type?: 'chairman' | 'representative' | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phone_override?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  address_override?: string | null;

  @Column({ type: 'varchar', length: 255 })
  updated_by!: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
