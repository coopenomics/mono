// payment-method-data.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';
import { t } from '~/i18n';

@InputType('SbpDataInput')
export class SBPDataInputDTO {
  @Field(() => String, { description: 'Мобильный телефон получателя' })
  @IsNotEmpty({ message: t('paymentMethod.sbpAccountInput.phoneRequired') })
  @IsString()
  phone!: string;
}
