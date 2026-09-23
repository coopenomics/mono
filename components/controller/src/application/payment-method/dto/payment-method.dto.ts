import { Field, ObjectType, createUnionType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsBoolean, ValidateNested, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';
import { SBPDataDTO } from './sbp-account.dto';
import { BankAccountDTO } from './bank-account.dto';
import type { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import type {
  BankTransferDataDomainInterface,
  SBPDataDomainInterface,
} from '~/domain/payment-method/interfaces/payment-methods-domain.interface';
import type { PaymentMethodDomainInterface } from '~/domain/payment-method/interfaces/payment-method-domain.interface';
import { t } from '~/i18n';

/**
 * Общий Union Type для данных метода оплаты
 */
export const PaymentMethodDataUnion = createUnionType({
  name: 'PaymentMethodData', // Имя, отображаемое в документации
  types: () => [SBPDataDTO, BankAccountDTO] as const,
  resolveType(value) {
    if ('phone' in value) {
      return SBPDataDTO;
    }
    if ('account_number' in value) {
      return BankAccountDTO;
    }
    return null;
  },
});

/**
 * Общий DTO для PaymentMethod
 */
@ObjectType('PaymentMethod')
export class PaymentMethodDTO implements PaymentMethodDomainInterface {
  @Field(() => String, { description: 'Имя пользователя, к которому привязан метод оплаты' })
  @IsNotEmpty({ message: t('paymentMethod.paymentMethodDto.usernameRequired') })
  @IsString()
  username!: string;

  @Field(() => Boolean, {
    description: 'Флаг основного метода платежа, который отображается в документах',
  })
  @IsNotEmpty({ message: t('paymentMethod.paymentMethodDto.isMainFlagRequired') })
  @IsBoolean()
  is_default!: boolean;

  @Field(() => String, { description: 'Тип метода оплаты (например, sbp, bank_transfer)' })
  @IsNotEmpty({ message: t('paymentMethod.paymentMethodDto.typeRequired') })
  @IsString()
  method_type!: 'sbp' | 'bank_transfer';

  @Field(() => PaymentMethodDataUnion, { description: 'Данные метода оплаты' })
  @IsDefined({ message: t('paymentMethod.paymentMethodDto.detailsRequired') })
  @ValidateNested()
  @Type((options) => {
    const object = options?.object as PaymentMethodDTO;
    if (object.method_type === 'sbp') {
      return SBPDataDTO;
    } else if (object.method_type === 'bank_transfer') {
      return BankAccountDTO;
    }
    throw new Error('Invalid method_type');
  })
  data!: SBPDataDTO | BankAccountDTO;

  @Field(() => String, { description: 'Идентификатор метода оплаты' })
  @IsNotEmpty({ message: t('paymentMethod.paymentMethodDto.idRequired') })
  @IsString()
  method_id!: string;

  @Field(() => Date, { description: 'Дата создания' })
  created_at!: Date;

  @Field(() => Date, { description: 'Дата обновления' })
  updated_at!: Date;

  /**
   * Конструктор для PaymentMethodDTO
   *
   * @param domainEntity - Доменная сущность PaymentMethodDomainEntity
   */
  constructor(domainEntity: PaymentMethodDomainEntity) {
    this.username = domainEntity.username;
    this.method_id = domainEntity.method_id;
    this.method_type = domainEntity.method_type;
    this.is_default = domainEntity.is_default;
    this.created_at = domainEntity.created_at;
    this.updated_at = domainEntity.updated_at;

    // Преобразование данных метода оплаты
    if (domainEntity.method_type === 'sbp') {
      this.data = new SBPDataDTO(domainEntity.data as SBPDataDomainInterface);
    } else if (domainEntity.method_type === 'bank_transfer') {
      this.data = new BankAccountDTO(domainEntity.data as BankTransferDataDomainInterface);
    } else {
      throw new Error(`Invalid method_type: ${domainEntity.method_type}`);
    }
  }
}
