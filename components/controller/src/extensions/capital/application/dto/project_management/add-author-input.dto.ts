import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { AddAuthorDomainInput } from '../../../domain/actions/add-author-domain-input.interface';

/**
 * GraphQL DTO для добавления автора проекта CAPITAL контракта
 */
@InputType('AddAuthorInput')
export class AddAuthorInputDTO implements AddAuthorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.addAuthorInput.coopname.required') })
  @IsString({ message: validationMessage('capital.addAuthorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.addAuthorInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.addAuthorInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя автора' })
  @IsNotEmpty({ message: validationMessage('capital.addAuthorInput.author.required') })
  @IsString({ message: validationMessage('capital.addAuthorInput.author.string') })
  author!: string;
}
