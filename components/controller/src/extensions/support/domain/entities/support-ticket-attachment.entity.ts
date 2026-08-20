/**
 * Файл, приложенный к сообщению переписки обращения.
 *
 * Принадлежит сообщению (`messageId` обязателен), `ticketId` продублирован,
 * чтобы список файлов обращения и проверка доступа не требовали соединения
 * таблиц (модель, раздел 5). Метаданные — здесь; тело файла — в MinIO.
 */
export interface SupportTicketAttachmentDomainEntity {
  id: string;
  ticketId: string;
  messageId: string;
  /** Ключ объекта в хранилище — единственное, что участвует в построении пути. */
  storageKey: string;
  /** Исходное имя файла — только для отображения, в путь хранилища не идёт. */
  originalFilename: string | null;
  /** Определяется сервером по содержимому файла, не берётся от клиента. */
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedByUsername: string;
  uploadedAt: Date;
}
