import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('BankAccountDetailsInput')
export class BankAccountDetailsInputDTO {
  @Field(() => String, { description: 'БИК банка' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountDetailsInput.bikRequired') })
  @NoMarkup()
  bik!: string;

  @Field(() => String, { description: 'Корреспондентский счет' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountDetailsInput.corrAccountRequired') })
  @IsString()
  @NoMarkup()
  corr!: string;
}
