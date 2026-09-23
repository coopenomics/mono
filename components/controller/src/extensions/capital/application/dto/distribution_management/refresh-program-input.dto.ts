import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshProgramDomainInput } from '../../../domain/actions/refresh-program-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для обновления CRPS пайщика в программе CAPITAL контракта
 */
@InputType('RefreshProgramInput')
export class RefreshProgramInputDTO implements RefreshProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.refreshProgramInput.coopname.required') })
  @IsString({ message: t('capital.refreshProgramInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.refreshProgramInput.username.required') })
  @IsString({ message: t('capital.refreshProgramInput.username.string') })
  username!: string;
}
