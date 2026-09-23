import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { FundProgramDomainInput } from '../../../domain/actions/fund-program-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для финансирования программы CAPITAL контракта
 */
@InputType('FundProgramInput')
export class FundProgramInputDTO implements FundProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.fundProgramInput.coopname.required') })
  @IsString({ message: t('capital.fundProgramInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Сумма финансирования' })
  @IsNotEmpty({ message: t('capital.fundProgramInput.amount.required') })
  @IsString({ message: t('capital.fundProgramInput.amount.string') })
  amount!: string;

  @Field(() => String, { description: 'Memo' })
  @IsNotEmpty({ message: t('capital.fundProgramInput.memo.required') })
  @IsString({ message: t('capital.fundProgramInput.memo.string') })
  memo!: string;
}
