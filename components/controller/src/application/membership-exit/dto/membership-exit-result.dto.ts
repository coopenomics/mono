import { Field, ObjectType } from '@nestjs/graphql';
import { MembershipExitStatus } from '../enums/membership-exit-status.enum';

/**
 * Результат подачи заявления на выход из кооператива.
 */
@ObjectType('MembershipExitResult')
export class MembershipExitResultDTO {
  @Field(() => String, { description: 'Хеш созданного процесса выхода' })
  exit_hash!: string;

  @Field(() => MembershipExitStatus, {
    description: 'Статус процесса выхода после подачи (ожидает подтверждения по ссылке из письма)',
  })
  status!: MembershipExitStatus;
}
