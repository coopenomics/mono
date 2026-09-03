import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAccessCarrier, EduConnectorHealth } from '../../domain/enums';

/**
 * Подключённая площадка кооператива и её состояние. Ключи API здесь НЕ лежат —
 * они в конфиге расширения под `secret:true`.
 */
@Entity({ name: 'edubridge_connector_bindings' })
@Index('IDX_edubridge_connector_bindings_unique', ['coopname', 'carrier'], { unique: true })
export class EdubridgeConnectorBindingEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'enum', enum: EduAccessCarrier })
  public carrier!: EduAccessCarrier;

  @Column({ type: 'boolean', default: true })
  public enabled!: boolean;

  @Column({ type: 'enum', enum: EduConnectorHealth, default: EduConnectorHealth.UNKNOWN })
  public health!: EduConnectorHealth;

  @Column({ type: 'timestamptz', nullable: true })
  public last_check_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  public last_check_message!: string | null;

  /** Учётные данные площадки (JSON полей), зашифрованные ключом ядра (`SECRET_CIPHER_PORT`). */
  @Column({ type: 'text', nullable: true })
  public credentials_encrypted!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public credentials_updated_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
