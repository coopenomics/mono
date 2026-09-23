import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';
import type { SearchPrivateAccountsInputDomainInterface } from '~/domain/common/interfaces/search-private-accounts-domain.interface';
import { t } from '~/i18n';

@InputType('SearchPrivateAccountsInput')
export class SearchPrivateAccountsInputDTO implements SearchPrivateAccountsInputDomainInterface {
  @Field(() => String, { description: 'Поисковый запрос для поиска приватных аккаунтов' })
  @IsString({ message: t('account.searchPrivateAccountsInput.queryMustBeString') })
  @IsNotEmpty({ message: t('account.searchPrivateAccountsInput.queryRequired') })
  query!: string;
}
