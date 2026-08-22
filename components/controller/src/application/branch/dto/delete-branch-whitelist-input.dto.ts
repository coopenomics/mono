import { Field, InputType } from '@nestjs/graphql';
import type { DeleteBranchWhitelistDomainInterface } from '~/domain/branch/interfaces/delete-branch-whitelist-domain-input.interface';

@InputType('DeleteBranchWhitelistInput')
export class DeleteBranchWhitelistGraphQLInput implements DeleteBranchWhitelistDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта пайщика, удаляемого из белого списка участка' })
  account!: string;
}
