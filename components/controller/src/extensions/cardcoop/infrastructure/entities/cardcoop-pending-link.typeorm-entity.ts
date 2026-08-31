import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Карта, связанная кандидатом до приёма в пайщики (story 7.5, FR-E5).
 *
 * Вступающий приходит со своей картой ещё на этапе регистрации — и это ровно то, чего мы
 * хотим: карта у человека уже есть, и заводить ему вторую значило бы обнулить накопленное
 * (PRD 4.3). Но свидетельствовать о членстве в этот момент нечего: совет ещё не принял
 * решения, и в цепи нет даты приёма, на которую документ обязан опираться.
 *
 * Поэтому связка ждёт здесь. Как только цепь запишет приём (`registrator::adduser`),
 * подтверждение выпускается по этой записи, и она удаляется.
 *
 * Одна запись на пайщика: карта у человека одна, а повторное уведомление о той же связке —
 * норма, сеть шлёт их с повторами.
 */
@Entity('cardcoop_pending_links')
export class CardcoopPendingLinkTypeormEntity {
  /** Пайщик кооператива, чья карта ждёт приёма. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  username!: string;

  /** Карта держателя в сети. */
  @Column({ name: 'card_id', type: 'varchar', length: 64 })
  cardId!: string;

  /** Номер карты для показа в столе, пока свидетельства ещё нет. */
  @Column({ name: 'card_number', type: 'varchar', length: 32, nullable: true })
  cardNumber!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
