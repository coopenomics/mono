import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { SetConfigDomainInput } from '../../../domain/actions/set-config-domain-input.interface';
import { ConfigInputDTO } from './config-input.dto';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для установки конфигурации CAPITAL контракта
 */
@InputType('SetConfigInput')
export class SetConfigInputDTO implements SetConfigDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.setConfigInput.coopname.required') })
  @IsString({ message: t('capital.setConfigInput.coopname.string') })
  coopname!: string;

  @Field(() => ConfigInputDTO, { description: 'Конфигурация контракта' })
  @Type(() => ConfigInputDTO)
  config!: ConfigInputDTO;
}
