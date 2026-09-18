import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('BankAccountDetailsInput')
export class BankAccountDetailsInputDTO {
  @Field(() => String, { description: 'БИК банка' })
  @IsNotEmpty({ message: 'БИК банка обязателен обязателен' })
  @NoMarkup()
  bik!: string;

  @Field(() => String, { description: 'Корреспондентский счет' })
  @IsNotEmpty({ message: 'Корр. счет обязателен' })
  @IsString()
  @NoMarkup()
  corr!: string;
}
