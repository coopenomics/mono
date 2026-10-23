import { InputType, Field } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsString, IsNotEmpty } from 'class-validator';
import type { SearchPrivateAccountsInputDomainInterface } from '~/domain/common/interfaces/search-private-accounts-domain.interface';

@InputType('SearchPrivateAccountsInput')
export class SearchPrivateAccountsInputDTO implements SearchPrivateAccountsInputDomainInterface {
  @Field(() => String, { description: 'Поисковый запрос для поиска приватных аккаунтов' })
  @IsString({ message: validationMessage('account.searchPrivateAccountsInput.queryMustBeString') })
  @IsNotEmpty({ message: validationMessage('account.searchPrivateAccountsInput.queryRequired') })
  query!: string;
}
