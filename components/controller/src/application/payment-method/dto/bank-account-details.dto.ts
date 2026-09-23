import { ObjectType, Field } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';

@ObjectType('BankAccountDetails')
export class BankAccountDetailsDTO {
  @Field(() => String, { description: 'БИК банка' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountDetails.bikRequired') })
  bik: string;

  @Field(() => String, { description: 'Корреспондентский счет' })
  @IsNotEmpty({ message: validationMessage('paymentMethod.bankAccountDetails.corrAccountRequired') })
  @IsString()
  corr: string;

  // TODO: удалить после 1 августа — legacy-поле, оставлено только чтобы старые клиенты не падали на GraphQL-валидации
  @Field(() => String, { nullable: true, description: 'КПП (устар.)' })
  kpp?: string;

  constructor(details: { bik: string; corr: string }) {
    this.bik = details.bik;
    this.corr = details.corr;
  }
}
