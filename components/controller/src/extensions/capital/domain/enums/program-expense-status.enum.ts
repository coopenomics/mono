import { registerEnumType } from '@nestjs/graphql';

export enum ProgramExpenseStatus {
  CREATED = 'created',
  APPROVED = 'approved',
  AUTHORIZED = 'authorized',
  PAID = 'paid',
  DECLINED = 'declined',
  UNDEFINED = 'undefined',
}

registerEnumType(ProgramExpenseStatus, {
  name: 'ProgramExpenseStatus',
  description: 'Статус расхода программы «Благорост» в контракте CAPITAL (таблица progexpenses).',
});
