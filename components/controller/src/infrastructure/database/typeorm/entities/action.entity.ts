import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { chainBlockTimeTransformer } from '~/infrastructure/blockchain/block-time.util';

/**
 * TypeORM сущность для хранения действий блокчейна
 * Реализует доменный интерфейс ActionDomainInterface
 */
@Entity('blockchain_actions')
@Index(['account', 'name'])
@Index(['block_num'])
@Index(['global_sequence'], { unique: true })
export class ActionEntity implements ActionDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  transaction_id!: string;

  @Column({ type: 'varchar', length: 16 })
  account!: string;

  @Column({ type: 'bigint' })
  block_num!: number;

  @Column({ type: 'varchar', length: 64 })
  block_id!: string;

  /**
   * Время блока из SHiP-трейса. В объекте — строка ISO (как приходит из
   * потока), в базе — `timestamptz`; перевод делает трансформер. Необязательно:
   * старый парсер времени не отдавал, и у записей тех времён колонка пуста.
   */
  @Column({ type: 'timestamptz', nullable: true, transformer: chainBlockTimeTransformer })
  block_time?: string;

  @Column({ type: 'varchar', length: 64 })
  chain_id!: string;

  @Column({ type: 'varchar', length: 16 })
  name!: string;

  @Column({ type: 'varchar', length: 16 })
  receiver!: string;

  @Column({ type: 'jsonb' })
  authorization!: Array<{
    actor: string;
    permission: string;
  }>;

  @Column({ type: 'jsonb' })
  data!: any;

  @Column({ type: 'integer' })
  action_ordinal!: number;

  @Column({ type: 'varchar', length: 32 })
  global_sequence!: string;

  @Column({ type: 'jsonb' })
  account_ram_deltas!: Array<{
    account: string;
    delta: number;
  }>;

  @Column({ type: 'text', nullable: true })
  console?: string;

  @Column({ type: 'jsonb' })
  receipt!: {
    receiver: string;
    act_digest: string;
    global_sequence: string;
    recv_sequence: string;
    auth_sequence: Array<{
      account: string;
      sequence: string;
    }>;
    code_sequence: number;
    abi_sequence: number;
  };

  @Column({ type: 'integer' })
  creator_action_ordinal!: number;

  @Column({ type: 'boolean' })
  context_free!: boolean;

  @Column({ type: 'integer' })
  elapsed!: number;

  @Column({ type: 'boolean', default: false })
  repeat!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
