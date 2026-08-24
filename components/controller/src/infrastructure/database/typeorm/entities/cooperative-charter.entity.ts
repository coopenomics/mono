import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export const EntityName = 'cooperative_charters';

/**
 * Устав кооператива, приложенный к заявке на подключение. Бинарь — в MinIO
 * `registrator:charters`, здесь только метаданные. Привязка — по аккаунту
 * кооператива (`username`) внутри контура союза (`coopname`).
 *
 * Уникальность по контрольной сумме не даёт положить один и тот же файл дважды;
 * новый файл того же кооператива просто добавляется, а показываем мы последний —
 * так у совета остаётся история присланных редакций устава.
 */
@Entity(EntityName)
@Index(`uq_${EntityName}_checksum`, ['coopname', 'username', 'checksum_sha256'], { unique: true })
@Index(`idx_${EntityName}_username`, ['coopname', 'username'])
export class CooperativeCharterEntity {
  static getTableName(): string {
    return EntityName;
  }

  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', comment: 'Контур союза, в котором хранится устав' })
  coopname!: string;

  @Column({ type: 'varchar', comment: 'Аккаунт кооператива, чей это устав' })
  username!: string;

  @Column({ type: 'varchar', length: 64 })
  checksum_sha256!: string;

  @Column({ type: 'varchar', length: 120 })
  mime_type!: string;

  @Column({ type: 'integer' })
  size_bytes!: number;

  @Column({ type: 'varchar', length: 512 })
  storage_key!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Оригинальное имя загруженного файла' })
  original_filename!: string | null;

  @Column({ type: 'varchar' })
  uploaded_by_username!: string;

  @CreateDateColumn({ type: 'timestamp' })
  uploaded_at!: Date;
}
