import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { OpenProjectDomainInput } from '../../../domain/actions/open-project-domain-input.interface';

/**
 * GraphQL DTO для открытия проекта для инвестиций CAPITAL контракта
 */
@InputType('OpenProjectInput')
export class OpenProjectInputDTO implements OpenProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.openProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.openProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.openProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.openProjectInput.projectHash.string') })
  project_hash!: string;
}
