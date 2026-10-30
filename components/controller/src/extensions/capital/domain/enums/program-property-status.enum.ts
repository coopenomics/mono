import { registerEnumType } from '@nestjs/graphql';
// Статусы программного имущественного взноса синхронизированные с блокчейн контрактом
export enum ProgramPropertyStatus {
  CREATED = 'created', // Программный имущественный взнос создан
  APPROVED = 'approved', // Программный имущественный взнос одобрен
  AUTHORIZED = 'authorized', // Программный имущественный взнос авторизован
  ACT1 = 'act1', // Первый акт подписан
  ACT2 = 'act2', // Акт подписан обеими сторонами: имущество принято, запись в цепи удалена
  DECLINED = 'declined', // Отклонено председателем или советом: запись в цепи удалена
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ProgramPropertyStatus, {
  name: 'ProgramPropertyStatus',
  description: 'Статус паевого взноса имуществом в программу «Благорост»',
});
