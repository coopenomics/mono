import { Field, InputType } from '@nestjs/graphql';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';

@InputType('SetPaymentStatusInput')
export class SetPaymentStatusInputDTO {
  @Field(() => String, { description: 'Идентификатор платежа, для которого устанавливается статус' })
  id!: string;

  @Field(() => PaymentStatusEnum, { description: 'Новый статус платежа' })
  status!: PaymentStatusEnum;

  @Field(() => String, {
    description: 'Причина изменения статуса. При отклонении платежа показывается пайщику как причина отказа.',
    nullable: true,
  })
  message?: string;
}
