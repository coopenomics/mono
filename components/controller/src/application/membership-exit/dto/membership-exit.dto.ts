import { Field, ObjectType } from '@nestjs/graphql';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { MembershipExitStatus } from '../enums/membership-exit-status.enum';

/**
 * Текущий процесс выхода пайщика из кооператива (если активен).
 */
@ObjectType('MembershipExit')
export class MembershipExitDTO {
  @Field(() => String, { description: 'Хеш процесса выхода' })
  exit_hash!: string;

  @Field(() => MembershipExitStatus, { description: 'Статус процесса выхода' })
  status!: MembershipExitStatus;

  @Field(() => String, { description: 'Сумма к возврату (фиксируется советом при одобрении; до одобрения — 0)' })
  quantity!: string;

  @Field(() => PaymentStatusEnum, {
    nullable: true,
    description:
      'Статус исходящего платежа возврата паевого взноса в реестре кассира. Создаётся при одобрении советом; null — платёж ещё не заведён.',
  })
  payment_status?: PaymentStatusEnum;

  @Field(() => String, { description: 'Дата подачи заявления на выход' })
  created_at!: string;
}
