import { SupportMessageAuthorRole } from '../enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../enums/support-system-event.enum';

/**
 * Запись в ленте обращения — сообщение человека или системное событие.
 *
 * Лента однородна: первый текст обращения — это первое сообщение, отдельного
 * поля `description` на обращении нет (модель, раздел 11, п. 1). Правка задним
 * числом исключена архитектурно: у записи нет `updatedAt`, а в интерфейсе
 * репозитория — метода обновления, только `append`.
 */
export interface SupportTicketMessageDomainEntity {
  id: string;
  ticketId: string;
  /** NULL только у действий самой системы (например, автозакрытие). */
  authorUsername: string | null;
  authorRole: SupportMessageAuthorRole;
  /** NULL для системных записей. */
  body: string | null;
  /** Заполняется только при `authorRole = SYSTEM`. */
  systemEvent: SupportSystemEvent | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}
