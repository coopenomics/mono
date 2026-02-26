import { registerEnumType } from '@nestjs/graphql';
/**
 * Перечисление статусов цикла разработки
 */
export enum CycleStatus {
  FUTURE = 'future', // Будущий цикл
  ACTIVE = 'active', // Активный цикл
  COMPLETED = 'completed', // Завершенный цикл
}

registerEnumType(CycleStatus, {
  name: 'CycleStatus',
  description: 'Статус цикла в системе CAPITAL',
});
