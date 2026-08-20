import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { SupportTicketTypeormEntity } from './support-ticket.typeorm-entity';
import { SupportTicketMessageTypeormEntity } from './support-ticket-message.typeorm-entity';

export const SupportTicketAttachmentEntityName = 'support_ticket_attachments';

/**
 * Метаданные вложения; тело файла — в MinIO (модель, раздел 5). Вложение
 * принадлежит сообщению (`message_id` обязателен), `ticket_id` продублирован
 * для списков и проверки доступа без соединения таблиц. Нет `kind` и
 * `coopname` — отличие от `expense_files`, сделанное сознательно.
 */
@Entity(SupportTicketAttachmentEntityName)
@Index(`idx_${SupportTicketAttachmentEntityName}_message`, ['messageId'])
@Index(`idx_${SupportTicketAttachmentEntityName}_ticket_uploaded`, ['ticketId', 'uploadedAt'])
@Index(`uq_${SupportTicketAttachmentEntityName}_ticket_checksum`, ['ticketId', 'checksumSha256'], { unique: true })
export class SupportTicketAttachmentTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id' })
  ticketId!: string;

  @ManyToOne(() => SupportTicketTypeormEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: SupportTicketTypeormEntity;

  @Column({ name: 'message_id' })
  messageId!: string;

  @ManyToOne(() => SupportTicketMessageTypeormEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'message_id' })
  message!: SupportTicketMessageTypeormEntity;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  storageKey!: string;

  /** Только для отображения — в построении `storage_key` не участвует. */
  @Column({ name: 'original_filename', type: 'varchar', length: 255, nullable: true })
  originalFilename!: string | null;

  /** Определяется сервером по содержимому файла, клиентскому значению не доверяем. */
  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64 })
  checksumSha256!: string;

  @Column({ name: 'uploaded_by_username', type: 'varchar', length: 64 })
  uploadedByUsername!: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt!: Date;
}
