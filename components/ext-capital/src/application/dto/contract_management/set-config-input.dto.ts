import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { SetConfigDomainInput } from '../../../domain/actions/set-config-domain-input.interface';
import { ConfigInputDTO } from './config-input.dto';

/**
 * GraphQL DTO для установки конфигурации CAPITAL контракта
 */
@InputType('SetConfigInput')
export class SetConfigInputDTO implements SetConfigDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => ConfigInputDTO, { description: 'Конфигурация контракта' })
  @Type(() => ConfigInputDTO)
  config!: ConfigInputDTO;
}
