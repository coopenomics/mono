import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CloseProjectDomainInput } from '../../../domain/actions/close-project-domain-input.interface';

/**
 * GraphQL DTO для закрытия проекта от инвестиций CAPITAL контракта
 */
@InputType('CloseProjectInput')
export class CloseProjectInputDTO implements CloseProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.closeProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.closeProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.closeProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.closeProjectInput.projectHash.string') })
  project_hash!: string;
}
