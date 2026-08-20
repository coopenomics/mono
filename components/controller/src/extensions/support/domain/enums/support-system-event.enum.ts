import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид системной записи в ленте обращения.
 */
export enum SupportSystemEvent {
  ASSIGNED = 'ASSIGNED',
  PRIORITY_CHANGED = 'PRIORITY_CHANGED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  AUTO_CLOSED = 'AUTO_CLOSED',
  REOPENED = 'REOPENED',
}

registerEnumType(SupportSystemEvent, {
  name: 'SupportSystemEvent',
  description: 'Вид события в системной записи ленты обращения.',
  valuesMap: {
    ASSIGNED: { description: 'Обращение взято в работу оператором.' },
    PRIORITY_CHANGED: { description: 'Изменён приоритет обращения.' },
    ESCALATED: { description: 'Обращение эскалировано председателю.' },
    RESOLVED: { description: 'Обращение помечено решённым.' },
    AUTO_CLOSED: { description: 'Обращение закрыто автоматически по истечении срока ожидания.' },
    REOPENED: { description: 'Обращение возвращено в работу автором.' },
  },
});
