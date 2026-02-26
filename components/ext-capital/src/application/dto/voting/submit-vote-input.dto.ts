import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { SubmitVoteDomainInput } from '../../../domain/actions/submit-vote-domain-input.interface';

/**
 * DTO для распределения голосов
 */
@InputType('VoteDistributionInput')
export class VoteDistributionInputDTO {
  @Field(() => String, { description: 'Получатель голосов' })
  @IsNotEmpty({ message: 'Получатель голосов не должен быть пустым' })
  @IsString({ message: 'Получатель голосов должен быть строкой' })
  recipient!: string;

  @Field(() => String, { description: 'Сумма голосов' })
  @IsNotEmpty({ message: 'Сумма голосов не должна быть пустой' })
  @IsString({ message: 'Сумма голосов должна быть строкой' })
  amount!: string;
}

/**
 * GraphQL DTO для голосования CAPITAL контракта
 */
@InputType('SubmitVoteInput')
export class SubmitVoteInputDTO implements Omit<SubmitVoteDomainInput, 'voter'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => [VoteDistributionInputDTO], { description: 'Распределение голосов' })
  @IsArray({ message: 'Распределение голосов должно быть массивом' })
  @ValidateNested({ each: true })
  @Type(() => VoteDistributionInputDTO)
  votes!: VoteDistributionInputDTO[];
}
