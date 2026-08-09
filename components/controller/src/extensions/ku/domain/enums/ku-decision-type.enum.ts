import { registerEnumType } from '@nestjs/graphql';

/**
 * Тип решения собрания пайщиков кооперативного участка
 */
export enum KuDecisionType {
  /** Учреждение кооперативного участка */
  CREATEBRANCH = 'createbranch',
  /** Свободное решение */
  FREE = 'free',
}

registerEnumType(KuDecisionType, {
  name: 'KuDecisionType',
  description: 'Тип решения собрания пайщиков кооперативного участка',
});
