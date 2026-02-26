import { registerEnumType } from '@nestjs/graphql';
/**
 * Перечисление приоритетов задач
 */
export enum IssuePriority {
  URGENT = 'urgent', // Срочный
  HIGH = 'high', // Высокий
  MEDIUM = 'medium', // Средний
  LOW = 'low', // Низкий
}

registerEnumType(IssuePriority, {
  name: 'IssuePriority',
  description: 'Приоритет задачи в системе CAPITAL',
});
