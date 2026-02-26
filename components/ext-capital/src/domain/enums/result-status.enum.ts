import { registerEnumType } from '@nestjs/graphql';
// Статусы результата синхронизированные с блокчейн контрактом
export enum ResultStatus {
  PENDING = 'pending', // Результат ожидает создания
  CREATED = 'created', // Результат создан, ожидает обработки
  APPROVED = 'approved', // Результат одобрен
  AUTHORIZED = 'authorized', // Результат авторизован
  ACT1 = 'act1', // Результат передан
  ACT2 = 'act2', // Результат принят
  DECLINED = 'declined', // Результат отклонен
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ResultStatus, {
  name: 'ResultStatus',
  description: 'Статус результата в системе CAPITAL',
});
