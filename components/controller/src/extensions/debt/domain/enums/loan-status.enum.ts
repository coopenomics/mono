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
  PAYDECLINED = 'PAYDECLINED',
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
    SIGNED: { description: 'Председатель подписал договор, договор залога и акт; акт ожидает подписи пайщика' },
    PAYING: { description: 'Акт подписан, передан на выплату кассиру' },
    PAYDECLINED: { description: 'Кассир отклонил платёж по реквизитам, ожидает повтора или отмены' },
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
  paydeclined: LoanStatus.PAYDECLINED,
  issued: LoanStatus.ISSUED,
  overdue: LoanStatus.OVERDUE,
};
