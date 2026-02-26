import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CloseProjectDomainInput } from '~/extensions/capital/domain/actions/close-project-domain-input.interface';

/**
 * GraphQL DTO для закрытия проекта от инвестиций CAPITAL контракта
 */
@InputType('CloseProjectInput')
export class CloseProjectInputDTO implements CloseProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;
}
