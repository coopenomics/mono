import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsEmail, IsString } from 'class-validator';
import type { CreateBranchDomainInput } from '~/domain/branch/interfaces/create-branch-domain-input.interface';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('CreateBranchInput')
export class CreateBranchGraphQLInput implements CreateBranchDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.coopnameRequired') })
  @IsString({ message: validationMessage('branch.createBranchInput.coopnameMustBeString') })
  @NoMarkup()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.branameRequired') })
  @IsString({ message: validationMessage('branch.createBranchInput.branameMustBeString') })
  @NoMarkup()
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта уполномоченного (председателя) кооперативного участка' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.trusteeNameRequired') })
  @NoMarkup()
  trustee!: string;

  @Field(() => String, { description: 'Краткое имя организации кооперативного участка' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.shortNameRequired') })
  @NoMarkup()
  short_name!: string;

  @Field(() => String, { description: 'Полное имя организации кооперативного участка' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.fullNameRequired') })
  @NoMarkup()
  full_name!: string;

  @Field(() => String, {
    description: 'Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..)',
  })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.basedOnRequired') })
  @NoMarkup()
  based_on!: string;

  @Field(() => String, { description: 'Фактический адрес' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.factAddressRequired') })
  @NoMarkup()
  fact_address!: string;

  @Field(() => String, { description: 'Телефон' })
  @IsNotEmpty({ message: validationMessage('branch.createBranchInput.phoneInvalid') })
  @NoMarkup()
  phone!: string;

  @Field(() => String, { description: 'Электронная почта' })
  @IsEmail({}, { message: validationMessage('branch.createBranchInput.emailInvalid') })
  @NoMarkup()
  email!: string;
}
