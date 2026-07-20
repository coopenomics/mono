import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { ExpenseFileKind } from '../../domain/enums/expense-file-kind.enum';

export const EntityName = 'expense_files';

@Entity(EntityName)
@Index(`uq_${EntityName}_checksum`, ['coopname', 'checksum_sha256'], { unique: true })
@Index(`idx_${EntityName}_proposal`, ['coopname', 'proposal_hash'])
@Index(`idx_${EntityName}_item`, ['coopname', 'proposal_hash', 'item_hash'])
export class ExpenseFileTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  proposal_hash!: string;

  @Column({ type: 'varchar', nullable: true })
  item_hash!: string | null;

  @Column({ type: 'enum', enum: ExpenseFileKind })
  kind!: ExpenseFileKind;

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
