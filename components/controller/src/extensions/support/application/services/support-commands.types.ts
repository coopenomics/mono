import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import type { SupportAttachmentInput } from './support-attachments.service';

/**
 * Приоритет во входных данных отсутствует намеренно: автор обращения его не
 * задаёт, все обращения заводятся со значением по умолчанию, а меняет его
 * оператор отдельной командой (спецификация, раздел 3). Если принять приоритет
 * здесь, решение обойдётся первым же пайщиком, ставящим «критический» всему.
 *
 * Кооператива здесь тоже нет: он берётся из настроек контура, а не от клиента.
 */
export interface CreateSupportTicketInput {
  kind: SupportTicketKind;
  subject: string;
  /** Первый текст обращения — он же первая запись ленты, отдельного поля нет. */
  body: string;
  attachments?: SupportAttachmentInput[];
}

export interface ReplySupportTicketInput {
  ticket_id: string;
  body: string;
  attachments?: SupportAttachmentInput[];
}

export interface AssignSupportTicketInput {
  ticket_id: string;
  assignee_username: string;
}

export interface ChangeSupportTicketPriorityInput {
  ticket_id: string;
  priority: SupportTicketPriority;
}

export interface ResolveSupportTicketInput {
  ticket_id: string;
  /** Необязательный комментарий оператора: попадёт в ленту отдельной записью. */
  comment?: string | null;
}

export interface EscalateSupportTicketInput {
  ticket_id: string;
  reason?: string | null;
}

/**
 * Подключение и отключение участника.
 *
 * Участие — подписка, а не право: совет и так читает любое обращение
 * кооператива и пишет в любое. Эти команды меняют, кого уведомлять и чью
 * очередь обращение пополнит, и ничего сверх того.
 */
export interface AddSupportTicketParticipantInput {
  ticket_id: string;
  participant_username: string;
}

export interface RemoveSupportTicketParticipantInput {
  ticket_id: string;
  participant_username: string;
}
