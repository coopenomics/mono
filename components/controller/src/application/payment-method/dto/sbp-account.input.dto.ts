// payment-method-data.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';
import { validationMessage } from '@coopenomics/extension-kit';
import { Field, InputType } from '@nestjs/graphql';

@InputType('SbpDataInput')
export class SBPDataInputDTO {
  @Field(() => String, { description: 'Мобильный телефон получателя' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.sbpAccountInput.phoneRequired') })
  @IsString()
  phone!: string;
}
