import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshProgramDomainInput } from '../../../domain/actions/refresh-program-domain-input.interface';

/**
 * GraphQL DTO для обновления CRPS пайщика в программе CAPITAL контракта
 */
@InputType('RefreshProgramInput')
export class RefreshProgramInputDTO implements RefreshProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;
}
