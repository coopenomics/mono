import { registerEnumType } from '@nestjs/graphql';
// Статусы участника синхронизированные с блокчейн контрактом
export enum ContributorStatus {
  PENDING = 'pending', // Участник зарегистрирован, ожидает одобрения
  APPROVED = 'approved', // Участник одобрен
  ACTIVE = 'active', // Участник активен
  INACTIVE = 'inactive', // Участник неактивен
  IMPORT = 'import', // Импортирован, требует завершения регистрации
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ContributorStatus, {
  name: 'ContributorStatus',
  description: 'Статус участника в системе CAPITAL',
});
