import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StartProjectDomainInput } from '../../../domain/actions/start-project-domain-input.interface';

/**
 * GraphQL DTO для запуска проекта CAPITAL контракта
 */
@InputType('StartProjectInput')
export class StartProjectInputDTO implements StartProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.startProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.startProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.startProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.startProjectInput.projectHash.string') })
  project_hash!: string;
}
