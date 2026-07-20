import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Предварительный расчёт суммы возврата паевого взноса при выходе.
 *
 * Считается по L3-балансам ledger2 на момент запроса. Итоговую сумму при
 * одобрении совет фиксирует контракт (registrator::confirmexit), поэтому это
 * ориентир для пайщика, а не обязательство.
 */
@ObjectType('MembershipExitReturnPreview')
export class MembershipExitReturnPreviewDTO {
  @Field(() => String, { description: 'Итоговая сумма к возврату (минимальный + целевой паевой)' })
  total!: string;

  @Field(() => String, { description: 'Целевой паевой взнос пайщика' })
  share_contribution!: string;

  @Field(() => String, { description: 'Минимальный паевой взнос пайщика' })
  minimum_contribution!: string;
}
