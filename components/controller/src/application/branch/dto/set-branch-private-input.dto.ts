import { Field, InputType } from '@nestjs/graphql';
import type { SetBranchPrivateDomainInterface } from '~/domain/branch/interfaces/set-branch-private-domain-input.interface';

@InputType('SetBranchPrivateInput')
export class SetBranchPrivateGraphQLInput implements SetBranchPrivateDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  braname!: string;

  @Field(() => Boolean, {
    description: 'Признак приватности участка: при включении выбрать участок смогут только пайщики из белого списка',
  })
  is_private!: boolean;
}
