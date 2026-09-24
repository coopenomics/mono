import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { StopProjectDomainInput } from '../../../domain/actions/stop-project-domain-input.interface';

/**
 * GraphQL DTO для остановки проекта CAPITAL контракта
 */
@InputType('StopProjectInput')
export class StopProjectInputDTO implements StopProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.stopProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.stopProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.stopProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.stopProjectInput.projectHash.string') })
  project_hash!: string;
}
