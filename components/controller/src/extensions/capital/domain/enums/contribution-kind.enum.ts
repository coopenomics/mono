import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид паевого взноса пайщика в программы Благороста — по операции книги учёта.
 */
export enum ContributionKind {
  MONEY = 'money', // Деньгами с главного кошелька (o.cap.invest)
  PROPERTY = 'property', // Имуществом по акту приёма-передачи (o.cap.actprp)
  RESULT = 'result', // Результатом интеллектуальной деятельности по акту (o.cap.ridshr)
  IMPORT = 'import', // Внесён до перехода кооператива на электронный учёт (o.cap.import)
}

/** Операция книги учёта → вид взноса. Другие операции capital взносами не являются. */
export const CONTRIBUTION_KIND_BY_OPERATION: Record<string, ContributionKind> = {
  'o.cap.invest': ContributionKind.MONEY,
  'o.cap.actprp': ContributionKind.PROPERTY,
  'o.cap.ridshr': ContributionKind.RESULT,
  'o.cap.import': ContributionKind.IMPORT,
};

registerEnumType(ContributionKind, {
  name: 'CapitalContributionKind',
  description: 'Вид паевого взноса: деньгами, имуществом, результатом интеллектуальной деятельности или перенесённый из учёта до перехода на электронный',
});
