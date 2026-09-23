import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('BankAccountDetailsInput')
export class BankAccountDetailsInputDTO {
  @Field(() => String, { description: 'БИК банка' })
  @IsNotEmpty({ message: t('paymentMethod.bankAccountDetailsInput.bikRequired') })
  @NoMarkup()
  bik!: string;

  @Field(() => String, { description: 'Корреспондентский счет' })
  @IsNotEmpty({ message: t('paymentMethod.bankAccountDetailsInput.corrAccountRequired') })
  @IsString()
  @NoMarkup()
  corr!: string;
}
