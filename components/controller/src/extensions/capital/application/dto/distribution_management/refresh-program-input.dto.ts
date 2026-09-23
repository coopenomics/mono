import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshProgramDomainInput } from '../../../domain/actions/refresh-program-domain-input.interface';

/**
 * GraphQL DTO для обновления CRPS пайщика в программе CAPITAL контракта
 */
@InputType('RefreshProgramInput')
export class RefreshProgramInputDTO implements RefreshProgramDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.refreshProgramInput.coopname.required') })
  @IsString({ message: validationMessage('capital.refreshProgramInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.refreshProgramInput.username.required') })
  @IsString({ message: validationMessage('capital.refreshProgramInput.username.string') })
  username!: string;
}
