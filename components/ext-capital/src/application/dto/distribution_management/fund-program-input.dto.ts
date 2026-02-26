import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { FundProgramDomainInput } from '../../../domain/actions/fund-program-domain-input.interface';

/**
 * GraphQL DTO для финансирования программы CAPITAL контракта
 */
@InputType('FundProgramInput')
export class FundProgramInputDTO implements FundProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Сумма финансирования' })
  @IsNotEmpty({ message: 'Сумма финансирования не должна быть пустой' })
  @IsString({ message: 'Сумма финансирования должна быть строкой' })
  amount!: string;

  @Field(() => String, { description: 'Memo' })
  @IsNotEmpty({ message: 'Memo не должно быть пустым' })
  @IsString({ message: 'Memo должно быть строкой' })
  memo!: string;
}
