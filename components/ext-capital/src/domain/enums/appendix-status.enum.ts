import { registerEnumType } from '@nestjs/graphql';
// Статусы приложения синхронизированные с блокчейн контрактом
export enum AppendixStatus {
  CREATED = 'created', // Приложение создано
  CONFIRMED = 'confirmed', // Приложение подтверждено
  DECLINED = 'declined', // Приложение отклонено
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(AppendixStatus, {
  name: 'AppendixStatus',
  description: 'Статус приложения в системе CAPITAL',
});
