import { Entity, PrimaryColumn, Column, Index, CreateDateColumn } from 'typeorm';

/**
 * Список уже применённых событий блокчейна — фундамент идемпотентности
 * (Story 2.1, INV-09, NFR5). Повторно доставленное событие с уже отмеченным
 * event_id распознаётся dispatch-путём как no-op (Story 2.3), что защищает от
 * двойного применения при at-least-once доставке Redis Streams.
 *
 * Без тяжёлых constraints (RT-03): event_id — PK, индекс по applied_at нужен
 * для retention-очистки старых меток (ориентир OQ-T04: Rollback Horizon × 2).
 *
 * event_id вычисляется локально по формуле parser2 (Story 2.2); после миграции
 * на parser2 (Epic 3) формула сверяется с авторитетной из движка.
 *
 * Story 4.1: добавлена колонка block_num — для очистки дедупа на форке
 * (deleteAfterBlock). Колонка nullable: старые записи (до Epic 4) её не имеют,
 * они доживут до своего retention по applied_at и не будут попадать под
 * WHERE block_num > N (PG NULL-сравнения возвращают unknown, строка не удалится).
 * Новые записи всегда несут block_num.
 */
@Entity('consumer_dedup')
export class ConsumerDedupEntity {
  @PrimaryColumn({ type: 'varchar', length: 512 })
  event_id!: string;

  @Index('idx_consumer_dedup_applied_at')
  @CreateDateColumn({ type: 'timestamptz' })
  applied_at!: Date;

  @Index('idx_consumer_dedup_block_num')
  @Column({ type: 'bigint', nullable: true })
  block_num!: string | null;
}
