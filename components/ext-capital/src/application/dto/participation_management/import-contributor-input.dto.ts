import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';
import type { ImportContributorDomainInput } from '../../../domain/actions/import-contributor-domain-input.interface';

/**
 * GraphQL DTO для импорта участника в CAPITAL контракт
 */
@InputType('ImportContributorInput')
export class ImportContributorInputDTO implements ImportContributorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: 'Имя аккаунта пользователя не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Сумма вклада' })
  @IsNotEmpty({ message: 'Сумма вклада не должна быть пустой' })
  @IsString({ message: 'Сумма вклада должна быть строкой' })
  contribution_amount!: string;

  @Field(() => String, { description: 'Номер договора участника' })
  @IsNotEmpty({ message: 'Номер договора не должен быть пустым' })
  @IsString({ message: 'Номер договора должен быть строкой' })
  contributor_contract_number!: string;

  @Field(() => String, { description: 'Дата создания договора участника (в формате DD.MM.YYYY)' })
  @IsNotEmpty({ message: 'Дата договора не должна быть пустой' })
  @IsString({ message: 'Дата договора должна быть строкой' })
  contributor_contract_created_at!: string;

  @Field(() => String, { description: 'Примечание', nullable: true })
  @IsOptional()
  @IsString({ message: 'Примечание должно быть строкой' })
  memo?: string;
}
