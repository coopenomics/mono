import { InputType, Field } from '@nestjs/graphql';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { PaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';

/**
 * DTO для фильтрации платежей
 */
@InputType('PaymentFiltersInput')
export class PaymentFiltersInputDTO implements PaymentFiltersDomainInterface {
  @Field(() => String, { nullable: true, description: 'Название кооператива' })
  coopname?: string;

  @Field(() => String, { nullable: true, description: 'Имя пользователя' })
  username?: string;

  @Field(() => PaymentStatusEnum, { nullable: true, description: 'Статус платежа' })
  status?: PaymentStatusEnum;

  @Field(() => PaymentTypeEnum, { nullable: true, description: 'Тип платежа' })
  type?: PaymentTypeEnum;

  @Field(() => PaymentDirectionEnum, { nullable: true, description: 'Направление платежа' })
  direction?: PaymentDirectionEnum;

  @Field(() => String, { nullable: true, description: 'Провайдер платежа' })
  provider?: string;

  @Field(() => String, { nullable: true, description: 'Хэш платежа' })
  hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хэш расхода (служебной записки): вернёт все платежи, связанные с этим расходом',
  })
  proposal_hash?: string;
}
