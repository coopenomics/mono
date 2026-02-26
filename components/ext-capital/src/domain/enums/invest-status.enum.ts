import { registerEnumType } from '@nestjs/graphql';

// Статусы инвестиции синхронизированные с блокчейн контрактом
export enum InvestStatus {
  PENDING = 'pending', // Инвестиция создана, ожидает одобрения
  APPROVED = 'approved', // Инвестиция одобрена
  ACTIVE = 'active', // Инвестиция активна
  RETURNED = 'returned', // Инвестиция возвращена
  CANCELLED = 'cancelled', // Инвестиция отменена
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(InvestStatus, {
  name: 'InvestStatus',
  description: 'Статусы инвестиции в системе CAPITAL',
});
