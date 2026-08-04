import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Заявление пайщика на выход, принятое и подписанное, но ещё НЕ отправленное в
 * блокчейн — ожидает подтверждения по ссылке из письма. После подтверждения
 * запись удаляется (источником истины становится on-chain registrator::exits),
 * при отмене — тоже удаляется. На один (coopname, username) — один активный
 * процесс выхода.
 *
 * statement хранит подписанный документ заявления (как пришёл с клиента),
 * чтобы при подтверждении отправить его в registrator::exitcoop без повторной
 * подписи пайщиком.
 */
@Entity('membership_exit_requests')
@Index(['coopname', 'username'], { unique: true })
export class MembershipExitRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  coopname!: string;

  @Column()
  username!: string;

  @Column({ name: 'exit_hash', length: 64 })
  exit_hash!: string;

  @Column({ type: 'jsonb' })
  statement!: Record<string, any>;

  @Column({ name: 'token', length: 1024 })
  token!: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
