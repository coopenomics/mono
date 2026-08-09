import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { PaymentFileKind } from '~/domain/gateway/enums/payment-file-kind.enum';

export const EntityName = 'payment_files';

/**
 * Файл, приложенный к платежу (чек об оплате). Бинарь — в MinIO `gateway:files`,
 * здесь только метаданные. Привязка — по `payment_hash` (единый ключ платежа).
 */
@Entity(EntityName)
@Index(`uq_${EntityName}_checksum`, ['coopname', 'checksum_sha256'], { unique: true })
@Index(`idx_${EntityName}_payment`, ['coopname', 'payment_hash'])
export class PaymentFileEntity {
  static getTableName(): string {
    return EntityName;
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  payment_hash!: string;

  @Column({ type: 'enum', enum: PaymentFileKind })
  kind!: PaymentFileKind;

  @Column({ type: 'varchar', length: 64 })
  checksum_sha256!: string;

  @Column({ type: 'varchar', length: 120 })
  mime_type!: string;

  @Column({ type: 'integer' })
  size_bytes!: number;

  @Column({ type: 'varchar', length: 512 })
  storage_key!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Оригинальное имя загруженного файла — для отображения и поиска' })
  original_filename!: string | null;

  @Column({ type: 'varchar' })
  uploaded_by_username!: string;

  @CreateDateColumn({ type: 'timestamp' })
  uploaded_at!: Date;
}
