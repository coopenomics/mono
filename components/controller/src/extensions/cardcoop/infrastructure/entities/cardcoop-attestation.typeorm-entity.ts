import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Состояние выданного подтверждения на стороне кооператива.
 *
 * Перечень, а не строки: значение читает и сравнивает код, а два параллельных
 * списка со временем разошлись бы.
 */
export enum CardcoopAttestationState {
  /** Документ составлен, но сеть его ещё не приняла — доставку нужно повторить. */
  Pending = 'pending',
  /** Сеть приняла подтверждение; известен его идентификатор. */
  Active = 'active',
  /** Кооператив отозвал подтверждение: членство прекращено. */
  Revoked = 'revoked',
  /** Сеть отвергла документ по существу — повторять бессмысленно, нужен разбор. */
  Rejected = 'rejected',
}

/**
 * Журнал подтверждений членства, выданных кооперативом в сеть «Карта кооператора».
 *
 * Зачем он нужен: отозвать подтверждение можно только по идентификатору,
 * который присваивает card.coop при приёме, а прекращение членства кооператив
 * узнаёт из цепи — там ни карты, ни идентификатора нет, только пайщик. Без этой
 * записи связать «пайщик вышел» с «какое подтверждение отзывать» нечем.
 *
 * Заодно журнал делает видимой недоставку: подтверждение, оставшееся в
 * `pending`, означает, что пайщик выпустил карту, а членство на ней не
 * подтвердилось.
 */
@Entity('cardcoop_attestations')
@Index(['username', 'state'])
export class CardcoopAttestationTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Пайщик кооператива, о котором выдано свидетельство. */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  username!: string;

  /** Карта держателя в сети. */
  @Column({ name: 'card_id', type: 'varchar', length: 64 })
  cardId!: string;

  /**
   * Номер карты — то, что человек называет вслух (story 7.4).
   *
   * Приезжает в уведомлении о связи. `null` у записей, заведённых до того, как сеть
   * начала его присылать: показывать в столе тогда нечего, но состояние членства
   * от этого не страдает.
   */
  @Column({ name: 'card_number', type: 'varchar', length: 32, nullable: true })
  cardNumber!: string | null;

  /**
   * Идентификатор подтверждения, присвоенный сетью при приёме.
   *
   * `null`, пока документ не доставлен: отзывать ещё нечего.
   */
  @Column({ name: 'attestation_id', type: 'varchar', length: 64, nullable: true })
  attestationId!: string | null;

  @Column({ type: 'varchar', length: 16, default: CardcoopAttestationState.Pending })
  state!: CardcoopAttestationState;

  /** Дата вступления, о которой свидетельствует документ. */
  @Column({ name: 'member_since', type: 'varchar', length: 10 })
  memberSince!: string;

  /** Причина отказа сети — для разбора оператором. */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
