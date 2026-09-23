// modules/appstore/dto/create-branch-graphql-input.dto.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import type { EditBranchDomainInput } from '~/domain/branch/interfaces/edit-branch-domain-input.interface';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';
import { t } from '~/i18n';

@InputType('EditBranchInput')
export class EditBranchGraphQLInput implements EditBranchDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @NoMarkup()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @NoMarkup()
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта уполномоченного (председателя) кооперативного участка' })
  @NoMarkup()
  trustee!: string;

  @Field(() => String, { description: 'Краткое имя организации кооперативного участка' })
  @NoMarkup()
  short_name!: string;

  @Field(() => String, { description: 'Полное имя организации кооперативного участка' })
  @NoMarkup()
  full_name!: string;

  @Field(() => String, {
    description: 'Документ, на основании которого действует Уполномоченный (решение совета №СС-.. от ..)',
  })
  @IsNotEmpty({ message: t('branch.editBranchInput.basedOnRequired') })
  @NoMarkup()
  based_on!: string;

  @Field(() => String, { description: 'Фактический адрес' })
  @NoMarkup()
  fact_address!: string;

  @Field(() => String, { description: 'Телефон' })
  @NoMarkup()
  phone!: string;

  @Field(() => String, { description: 'Электронная почта' })
  @NoMarkup()
  email!: string;
}
