import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { SetMasterDomainInput } from '../../../domain/actions/set-master-domain-input.interface';

/**
 * GraphQL DTO для установки мастера проекта CAPITAL контракта
 */
@InputType('SetMasterInput')
export class SetMasterInputDTO implements SetMasterDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsString({ message: 'Имя мастера проекта должно быть строкой' })
  master!: string;
}
