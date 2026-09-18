import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsEmail, IsString } from 'class-validator';
import type { CreateBranchDomainInput } from '~/domain/branch/interfaces/create-branch-domain-input.interface';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('CreateBranchInput')
export class CreateBranchGraphQLInput implements CreateBranchDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  @NoMarkup()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @IsNotEmpty({ message: 'Имя аккаунта кооперативного участка не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооперативного участка должно быть строкой' })
  @NoMarkup()
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта уполномоченного (председателя) кооперативного участка' })
  @IsNotEmpty({ message: 'Имя уполномоченного не должно быть пустым' })
  @NoMarkup()
  trustee!: string;

  @Field(() => String, { description: 'Краткое имя организации кооперативного участка' })
  @IsNotEmpty({ message: 'Краткое имя организации кооперативного участка не должно быть пустым' })
  @NoMarkup()
  short_name!: string;

  @Field(() => String, { description: 'Полное имя организации кооперативного участка' })
  @IsNotEmpty({ message: 'Полное имя организации кооперативного участка не должно быть пустым' })
  @NoMarkup()
  full_name!: string;

  @Field(() => String, {
    description: 'Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..)',
  })
  @IsNotEmpty({ message: 'Документ, на основании которого действует Упомолноченный, должен быть заданы' })
  @NoMarkup()
  based_on!: string;

  @Field(() => String, { description: 'Фактический адрес' })
  @IsNotEmpty({ message: 'Фактический адрес не должен быть пустым' })
  @NoMarkup()
  fact_address!: string;

  @Field(() => String, { description: 'Телефон' })
  @IsNotEmpty({ message: 'Телефон должен быть валидным номером' })
  @NoMarkup()
  phone!: string;

  @Field(() => String, { description: 'Электронная почта' })
  @IsEmail({}, { message: 'Электронная почта должна быть валидной' })
  @NoMarkup()
  email!: string;
}
