import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('BankAccountDetailsInput')
export class BankAccountDetailsInputDTO {
  @Field(() => String, { description: 'БИК банка' })
  @IsNotEmpty({ message: 'БИК банка обязателен обязателен' })
  bik!: string;

  @Field(() => String, { description: 'Корреспондентский счет' })
  @IsNotEmpty({ message: 'Корр. счет обязателен' })
  @IsString()
  corr!: string;
}
