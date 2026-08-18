import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { DeltaDomainInterface } from '~/domain/parser/interfaces/delta-domain.interface';
import { chainBlockTimeTransformer } from '~/infrastructure/blockchain/block-time.util';

/**
 * TypeORM сущность для хранения дельт таблиц блокчейна
 * Реализует доменный интерфейс DeltaDomainInterface
 */
@Entity('blockchain_deltas')
@Index(['code', 'table'])
@Index(['block_num'])
@Index(['primary_key'])
@Index(['code', 'scope', 'table', 'primary_key'])
export class DeltaEntity implements DeltaDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  chain_id!: string;

  @Column({ type: 'bigint' })
  block_num!: number;

  @Column({ type: 'varchar' })
  block_id!: string;

  /**
   * Время блока из SHiP-трейса. В объекте — строка ISO (как приходит из
   * потока), в базе — `timestamptz`; перевод делает трансформер. Необязательно:
   * старый парсер времени не отдавал, и у записей тех времён колонка пуста.
   */
  @Column({ type: 'timestamptz', nullable: true, transformer: chainBlockTimeTransformer })
  block_time?: string;

  @Column({ type: 'boolean' })
  present!: boolean;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  scope!: string;

  @Column({ type: 'varchar' })
  table!: string;

  @Column({ type: 'varchar' })
  primary_key!: string;

  @Column({ type: 'jsonb', nullable: true })
  value?: any;

  @Column({ type: 'boolean', default: false })
  repeat!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
