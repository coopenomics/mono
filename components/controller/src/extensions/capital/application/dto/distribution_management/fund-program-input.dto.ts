import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { FundProgramDomainInput } from '../../../domain/actions/fund-program-domain-input.interface';

/**
 * GraphQL DTO для финансирования программы CAPITAL контракта
 */
@InputType('FundProgramInput')
export class FundProgramInputDTO implements FundProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.fundProgramInput.coopname.required') })
  @IsString({ message: validationMessage('capital.fundProgramInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Сумма финансирования' })
  @IsNotEmpty({ message: validationMessage('capital.fundProgramInput.amount.required') })
  @IsString({ message: validationMessage('capital.fundProgramInput.amount.string') })
  amount!: string;

  @Field(() => String, { description: 'Memo' })
  @IsNotEmpty({ message: validationMessage('capital.fundProgramInput.memo.required') })
  @IsString({ message: validationMessage('capital.fundProgramInput.memo.string') })
  memo!: string;
}
