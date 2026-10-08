import { registerEnumType } from '@nestjs/graphql';

/**
 * Состояние займа в зеркале. Пока заём открыт — повторяет состояние цепи;
 * после удаления записи в цепи зеркало выводит итог: закрыт возвратом или
 * списанием (был выдан) либо отклонён и отменён до выплаты (выдан не был).
 */
export enum LoanStatus {
  CREATED = 'CREATED',
  AUTHORIZED = 'AUTHORIZED',
  SIGNED = 'SIGNED',
  PAYING = 'PAYING',
  ISSUED = 'ISSUED',
  OVERDUE = 'OVERDUE',
  CLOSED = 'CLOSED',
  DECLINED = 'DECLINED',
  UNDEFINED = 'UNDEFINED',
}

registerEnumType(LoanStatus, {
  name: 'DebtLoanStatus',
  description: 'Состояние беспроцентного займа',
  valuesMap: {
    CREATED: { description: 'Заявление подано, на рассмотрении совета' },
    AUTHORIZED: { description: 'Совет разрешил, договор ожидает подписи председателя' },
    SIGNED: { description: 'Договор подписан, кассир отклонил платёж по реквизитам, ожидает повтора' },
    PAYING: { description: 'Передан на выплату кассиру' },
    ISSUED: { description: 'Выдан, идёт срок возврата' },
    OVERDUE: { description: 'Срок возврата прошёл' },
    CLOSED: { description: 'Закрыт возвратом или обращением обеспечения' },
    DECLINED: { description: 'Отклонён или отменён до выплаты' },
    UNDEFINED: { description: 'Состояние не определено' },
  },
});

/** Состояние цепи (`Debt::Status`) → состояние зеркала. */
export const CHAIN_STATUS_TO_LOAN_STATUS: Record<string, LoanStatus> = {
  created: LoanStatus.CREATED,
  authorized: LoanStatus.AUTHORIZED,
  signed: LoanStatus.SIGNED,
  paying: LoanStatus.PAYING,
  issued: LoanStatus.ISSUED,
  overdue: LoanStatus.OVERDUE,
};
