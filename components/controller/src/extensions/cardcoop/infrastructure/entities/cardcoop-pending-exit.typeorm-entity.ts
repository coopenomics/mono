import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Начатый выход пайщика из кооператива: соответствие «процесс выхода → пайщик».
 *
 * Нужен потому, что завершение выхода в цепи (`registrator::completexit`)
 * называет только процесс, а не человека: запись о выходе к этому моменту уже
 * удалена самим контрактом, и спросить у цепи, чей это был выход, поздно.
 * Поэтому пайщик запоминается в начале процесса (`exitcoop`) и читается в конце.
 *
 * Запись живёт ровно до исхода процесса: завершился выход или совет его
 * отклонил — она удаляется. Незавершённый выход держать вечно незачем, но и
 * чистить его по времени нельзя: совет может рассматривать заявление долго.
 */
@Entity('cardcoop_pending_exits')
export class CardcoopPendingExitTypeormEntity {
  /** Хэш процесса выхода — им цепь называет процесс во всех действиях. */
  @PrimaryColumn({ name: 'exit_hash', type: 'varchar', length: 64 })
  exitHash!: string;

  @Column({ type: 'varchar', length: 64 })
  username!: string;

  @Column({ type: 'varchar', length: 64 })
  coopname!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
