import { SupportTicketKind } from '../enums/support-ticket-kind.enum';
import { SupportTicketStatus } from '../enums/support-ticket-status.enum';
import { SupportTicketPriority } from '../enums/support-ticket-priority.enum';
import { SupportResponsibilityZone } from '../enums/support-responsibility-zone.enum';

/**
 * Обращение пайщика в совет кооператива.
 *
 * Блокчейна и синхронизации нет: источник истины — сама таблица в PostgreSQL,
 * поэтому сущность плоская, без `db`/`bc`-развилки и без наследования от
 * `BaseTypeormEntity`.
 */
export interface SupportTicketDomainEntity {
  id: string;
  /** Человеко-читаемый номер обращения — значение postgres-последовательности, приходит строкой. */
  number: string;
  coopname: string;
  kind: SupportTicketKind;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  subject: string;
  authorUsername: string;
  assigneeUsername: string | null;
  responsibilityZone: SupportResponsibilityZone;
  lastMessageAt: Date;
  resolvedAt: Date | null;
  escalatedAt: Date | null;
  reopenCount: number;
  createdAt: Date;
  updatedAt: Date;
}
