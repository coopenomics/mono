import { registerEnumType } from '@nestjs/graphql';

/**
 * Назначение файла в MinIO-бакете `expenses:files`.
 */
export enum ExpenseFileKind {
  PAYMENT_PROOF = 'PAYMENT_PROOF',
  REPORT_FILE = 'REPORT_FILE',
  RETURN_PROOF = 'RETURN_PROOF',
  CLOSING_DOC = 'CLOSING_DOC',
}

registerEnumType(ExpenseFileKind, {
  name: 'ExpenseFileKind',
  description: 'Тип первичного файла расхода.',
  valuesMap: {
    PAYMENT_PROOF: { description: 'Платёжка/квитанция кассира об исполненной оплате.' },
    REPORT_FILE: { description: 'Чек/первичка пайщика по отчёту об авансе под отчёт.' },
    RETURN_PROOF: { description: 'Подтверждение возврата неиспользованного аванса.' },
    CLOSING_DOC: { description: 'Закрывающий документ по оплате организации (акт/счёт-фактура/накладная).' },
  },
});
