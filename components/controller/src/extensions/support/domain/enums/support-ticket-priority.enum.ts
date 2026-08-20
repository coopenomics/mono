import { registerEnumType } from '@nestjs/graphql';

/**
 * Приоритет обращения в поддержку. По умолчанию — `NORMAL`.
 */
export enum SupportTicketPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

registerEnumType(SupportTicketPriority, {
  name: 'SupportTicketPriority',
  description: 'Приоритет обращения в поддержку.',
  valuesMap: {
    LOW: { description: 'Низкий приоритет.' },
    NORMAL: { description: 'Обычный приоритет.' },
    HIGH: { description: 'Высокий приоритет.' },
    CRITICAL: { description: 'Критический приоритет.' },
  },
});
