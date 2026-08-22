import { registerEnumType } from '@nestjs/graphql';
/**
 * Перечисление приоритетов проектов и компонентов.
 * Хранится только в базе данных (в блокчейн не отправляется).
 */
export enum ProjectPriority {
  URGENT = 'urgent', // Срочный
  HIGH = 'high', // Высокий
  MEDIUM = 'medium', // Средний
  LOW = 'low', // Низкий
}

registerEnumType(ProjectPriority, {
  name: 'ProjectPriority',
  description: 'Приоритет проекта или компонента в системе CAPITAL',
});
