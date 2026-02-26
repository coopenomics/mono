import { registerEnumType } from '@nestjs/graphql';
// Статусы расхода синхронизированные с блокчейн контрактом
export enum ExpenseStatus {
  PENDING = 'pending', // Расход создан, ожидает одобрения
  APPROVED = 'approved', // Расход одобрен
  PAID = 'paid', // Расход оплачен
  DECLINED = 'declined', // Расход отклонен
  CANCELLED = 'cancelled', // Расход отменен
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ExpenseStatus, {
  name: 'ExpenseStatus',
  description: 'Статус расхода в системе CAPITAL',
});
