import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { RobotKeyDomainEntity } from '../../domain/entities/robot-key.entity';

/**
 * Ключи разрешений робота. Приватный ключ лежит зашифрованным ключом
 * кооператива (порт шифрования секретов ядра); наружу отдаётся только
 * публичная часть.
 */
@Entity('soviet_robot_keys')
@Index(['coopname', 'member'], { unique: true })
export class RobotKeyTypeormEntity implements RobotKeyDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 13 })
  coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  member!: string;

  @Column({ type: 'varchar', length: 13 })
  permission_name!: string;

  @Column({ type: 'text' })
  encrypted_wif!: string;

  @Column({ type: 'varchar', length: 80 })
  public_key!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
