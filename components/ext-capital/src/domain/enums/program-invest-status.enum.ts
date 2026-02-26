import { registerEnumType } from '@nestjs/graphql';
// Статусы программной инвестиции синхронизированные с блокчейн контрактом
export enum ProgramInvestStatus {
  CREATED = 'created', // Программная инвестиция создана
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ProgramInvestStatus, {
  name: 'ProgramInvestStatus',
  description: 'Статус программной инвестиции в системе CAPITAL',
});
