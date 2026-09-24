import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { DeleteProjectDomainInput } from '../../../domain/actions/delete-project-domain-input.interface';

/**
 * GraphQL DTO для удаления проекта CAPITAL контракта
 */
@InputType('DeleteProjectInput')
export class DeleteProjectInputDTO implements DeleteProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.deleteProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.deleteProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.deleteProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.deleteProjectInput.projectHash.string') })
  project_hash!: string;
}
