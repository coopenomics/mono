import { Field, ObjectType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsBoolean, IsDefined } from 'class-validator';
import { BankAccountDTO } from './bank-account.dto';
import type { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type { BankTransferDataDomainInterface } from '~/domain/payment-method/interfaces/payment-methods-domain.interface';
import type { BankPaymentMethodDomainInterface } from '~/domain/payment-method/interfaces/bank-payment-method-domain.interface';

/**
 * DTO для BankPaymentMethod
 */
@ObjectType('BankPaymentMethod')
export class BankPaymentMethodDTO implements BankPaymentMethodDomainInterface {
  @Field(() => String, { description: 'Имя пользователя, к которому привязан метод оплаты' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankPaymentMethod.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankPaymentMethod.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => String, { description: 'Тип метода оплаты' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankPaymentMethod.typeRequired') })
  @IsString()
  method_type!: 'bank_transfer';

  @Field(() => BankAccountDTO, { description: 'Данные метода оплаты' })
  @IsDefined({ message: validationMessage('paymentMethod.bankPaymentMethod.detailsRequired') })
  data!: BankAccountDTO;

  @Field(() => String, { description: 'Идентификатор метода оплаты' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankPaymentMethod.idRequired') })
  @IsString()
  method_id!: string;

  @Field(() => Date, { description: 'Дата создания' })
  created_at!: Date;

  @Field(() => Date, { description: 'Дата обновления' })
  updated_at!: Date;

  /**
   * Конструктор для BankPaymentMethodDTO
   *
   * @param domainEntity - Доменная сущность BankPaymentMethodDomainEntity
   */
  constructor(domainEntity: PaymentMethodDomainEntity) {
    this.username = domainEntity.username;
    this.method_id = domainEntity.method_id;
    this.method_type = 'bank_transfer';
    this.is_default = domainEntity.is_default;
    this.created_at = domainEntity.created_at;
    this.updated_at = domainEntity.updated_at;
    this.data = new BankAccountDTO(domainEntity.data as BankTransferDataDomainInterface);
  }
}
