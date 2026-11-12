import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид контрагента — получателя оплаты по реквизитам. Физическое лицо
 * контрагентом не бывает: пайщику платят авансом под отчёт на его собственные
 * реквизиты. Значения совпадают с видами пакета юрисдикций.
 */
export enum ExpenseCounterpartyKind {
  /** Юридическое лицо. */
  LEGAL = 'LEGAL',
  /** Индивидуальный предприниматель. */
  ENTREPRENEUR = 'ENTREPRENEUR',
}

registerEnumType(ExpenseCounterpartyKind, {
  name: 'ExpenseCounterpartyKind',
  description: 'Вид контрагента: юридическое лицо или индивидуальный предприниматель.',
  valuesMap: {
    LEGAL: { description: 'Юридическое лицо.' },
    ENTREPRENEUR: { description: 'Индивидуальный предприниматель.' },
  },
});
