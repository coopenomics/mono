import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { SetMasterDomainInput } from '../../../domain/actions/set-master-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для установки мастера проекта CAPITAL контракта
 */
@InputType('SetMasterInput')
export class SetMasterInputDTO implements SetMasterDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.setMasterInput.coopname.required') })
  @IsString({ message: t('capital.setMasterInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.setMasterInput.projectHash.required') })
  @IsString({ message: t('capital.setMasterInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsString({ message: t('capital.setMasterInput.master.string') })
  master!: string;
}
