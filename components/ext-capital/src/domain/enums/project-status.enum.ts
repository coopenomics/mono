import { registerEnumType } from '@nestjs/graphql';

// Статусы проекта синхронизированные с блокчейн контрактом
export enum ProjectStatus {
  PENDING = 'pending', // Проект создан
  ACTIVE = 'active', // Проект активен для коммитов
  VOTING = 'voting', // Проект на голосовании
  RESULT = 'result', // Проект завершен
  FINALIZED = 'finalized', // Проект финализирован (все конвертации завершены, неиспользованные средства возвращены)
  CANCELLED = 'cancelled', // Проект отменен
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ProjectStatus, {
  name: 'ProjectStatus',
  description: 'Статусы проекта в системе CAPITAL',
});
