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

  // Тип совпадает с банком у банковского счёта: поля одного имени в объединении
  // обязаны отдавать один тип, иначе запрос к обоим вариантам сервер отклоняет.
  @Field(() => String, {
    description: 'Банк получателя. У реквизитов, сохранённых до появления поля, пустая строка',
  })
  bank_name!: string;

  /**
   * Конструктор для SBPDataDTO
   *
   * @param domainData - Данные из доменного интерфейса SBPDataDomainInterface
   */
  constructor(domainData: SBPDataDomainInterface) {
    this.phone = domainData.phone;
    this.bank_name = domainData.bank_name ?? '';
  }
}
