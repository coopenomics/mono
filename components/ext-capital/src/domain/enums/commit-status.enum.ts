import { registerEnumType } from '@nestjs/graphql';
// Статусы коммита синхронизированные с блокчейн контрактом
export enum CommitStatus {
  CREATED = 'created', // Коммит создан, ожидает подтверждения
  APPROVED = 'approved', // Коммит одобрен
  DECLINED = 'declined', // Коммит отклонен
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(CommitStatus, {
  name: 'CommitStatus',
  description: 'Статус коммита в системе CAPITAL',
});
