import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Журнал объявлений допуска, сделанных оператором сети (story 7.6, FR-E6).
 *
 * Оператор объявляет card.coop, что кооператив принят в сеть. Уведомление уходит по сети и
 * может не дойти; активацию кооператива это не блокирует (критерий приёмки story 7.6) —
 * поэтому исход каждой доставки записывается здесь, недоставленные повторяются на старте,
 * а оператор видит, что зависло, вместо того чтобы догадываться.
 */
@Entity('cardcoop_operator_announcements')
export class CardcoopOperatorAnnouncementTypeormEntity {
  /** Кооператив, о допуске которого объявлено. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  coopname!: string;

  /** Наименование, отданное в объявлении, — из записи цепи. */
  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  /** Дошло ли объявление до сети. */
  @Column({ type: 'boolean', default: false })
  delivered!: boolean;

  /** Причина последней неудачи; `null` — доставлено либо ещё не пробовали. */
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
