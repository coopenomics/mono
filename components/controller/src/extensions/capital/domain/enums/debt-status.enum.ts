import { registerEnumType } from '@nestjs/graphql';

/**
 * Состояние займа. Значения совпадают со статусами в контракте `capital`:
 * зеркало не переименовывает их, иначе отбор по состоянию расходится с цепью.
 */
export enum DebtStatus {
  CREATED = 'created', // Заявка подана
  APPROVED = 'approved', // Заявку одобрил председатель
  AUTHORIZED = 'authorized', // Совет разрешил выдачу; платёж не отправлен либо вернулся с отказом
  PAY_PENDING = 'paypending', // Платёж отправлен, ждём подтверждения или отказа
  PAID = 'paid', // Заём выдан и ждёт возврата
  OVERDUE = 'overdue', // Срок возврата прошёл
  SETTLED = 'settled', // Заём возвращён
  WRITEOFF = 'writeoff', // Заём списан: работа-обеспечение перешла кооперативу
  UNDEFINED = 'undefined', // Состояние не определено
}

registerEnumType(DebtStatus, {
  name: 'DebtStatus',
  description: 'Состояние займа пайщика',
});
