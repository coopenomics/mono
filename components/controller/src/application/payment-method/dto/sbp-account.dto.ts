// payment-method-data.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';
import { Field, ObjectType } from '@nestjs/graphql';
import type { SBPDataDomainInterface } from '~/domain/payment-method/interfaces/payment-methods-domain.interface';

@ObjectType('SbpAccount')
export class SBPDataDTO {
  @Field(() => String, { description: 'Мобильный телефон получателя' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.sbpAccount.phoneRequired') })
  @IsString()
  phone!: string;

  /**
   * Конструктор для SBPDataDTO
   *
   * @param domainData - Данные из доменного интерфейса SBPDataDomainInterface
   */
  constructor(domainData: SBPDataDomainInterface) {
    this.phone = domainData.phone;
  }
}
