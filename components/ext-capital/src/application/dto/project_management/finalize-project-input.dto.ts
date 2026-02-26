import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { IFinalizeProjectDomainInput } from '~/extensions/capital/domain/actions/finalize-project-domain-input.interface';

/**
 * GraphQL DTO для финализации проекта CAPITAL контракта
 * Финализация проекта после завершения всех конвертаций участников
 */
@InputType('FinalizeProjectInput')
export class FinalizeProjectInputDTO implements IFinalizeProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта для финализации' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;
}
