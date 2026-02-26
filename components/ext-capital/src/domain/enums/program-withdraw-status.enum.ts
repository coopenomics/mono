import { registerEnumType } from '@nestjs/graphql';
// Статусы возврата из программы синхронизированные с блокчейн контрактом
export enum ProgramWithdrawStatus {
  CREATED = 'created', // Запрос на возврат создан
  APPROVED = 'approved', // Запрос на возврат одобрен
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ProgramWithdrawStatus, {
  name: 'ProgramWithdrawStatus',
  description: 'Статус возврата из программы в системе CAPITAL',
});
