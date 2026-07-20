import { Field, InputType } from '@nestjs/graphql';
import type { AddBranchWhitelistDomainInterface } from '~/domain/branch/interfaces/add-branch-whitelist-domain-input.interface';

@InputType('AddBranchWhitelistInput')
export class AddBranchWhitelistGraphQLInput implements AddBranchWhitelistDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта пайщика, добавляемого в белый список участка' })
  account!: string;
}
