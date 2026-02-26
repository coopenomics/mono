import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { AddAuthorDomainInput } from '../../../domain/actions/add-author-domain-input.interface';

/**
 * GraphQL DTO для добавления автора проекта CAPITAL контракта
 */
@InputType('AddAuthorInput')
export class AddAuthorInputDTO implements AddAuthorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Имя автора' })
  @IsNotEmpty({ message: 'Имя автора не должно быть пустым' })
  @IsString({ message: 'Имя автора должно быть строкой' })
  author!: string;
}
