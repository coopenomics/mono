import { ObjectType, Field } from '@nestjs/graphql';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import type { RegistrationPaymentDomainInterface } from '~/domain/account/interfaces/registration-payment-domain.interface';

@ObjectType('RegistrationPayment')
export class RegistrationPaymentDTO {
  @Field(() => PaymentStatusEnum, { description: 'Статус вступительного платежа' })
  public readonly status: PaymentStatusEnum;

  @Field(() => String, {
    description: 'Причина изменения статуса. При отклонении платежа — причина отказа, которую видит пайщик.',
    nullable: true,
  })
  public readonly message?: string | null;

  @Field(() => String, { description: 'Хэш платежа' })
  public readonly hash: string;

  @Field(() => Number, { description: 'Сумма вступительного платежа' })
  public readonly quantity: number;

  @Field(() => String, { description: 'Символ валюты платежа' })
  public readonly symbol: string;

  constructor(entity: RegistrationPaymentDomainInterface) {
    this.status = entity.status;
    this.message = entity.message ?? null;
    this.hash = entity.hash;
    this.quantity = entity.quantity;
    this.symbol = entity.symbol;
  }
}
