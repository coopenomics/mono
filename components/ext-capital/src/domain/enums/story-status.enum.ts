import { registerEnumType } from '@nestjs/graphql';
/**
 * Перечисление статусов историй (критериев выполнения)
 */
export enum StoryStatus {
  PENDING = 'pending', // Ожидает выполнения
  COMPLETED = 'completed', // Выполнена
  CANCELLED = 'cancelled', // Отменена
}

registerEnumType(StoryStatus, {
  name: 'StoryStatus',
  description: 'Статус истории в системе CAPITAL',
});
