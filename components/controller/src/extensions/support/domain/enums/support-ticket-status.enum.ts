import { registerEnumType } from '@nestjs/graphql';

/**
 * Статус обращения в поддержку.
 */
export enum SupportTicketStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

registerEnumType(SupportTicketStatus, {
  name: 'SupportTicketStatus',
  description: 'Статус обращения в поддержку.',
  valuesMap: {
    NEW: { description: 'Обращение создано и ещё не взято в работу.' },
    IN_PROGRESS: { description: 'Обращение в работе.' },
    RESOLVED: { description: 'Обращение решено.' },
    CLOSED: { description: 'Обращение закрыто.' },
  },
});
