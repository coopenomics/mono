import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { t } from '../../../i18n';

/**
 * GraphQL Input DTO для получения конфигурации CAPITAL контракта
 */
@InputType('GetCapitalConfigInput')
export class GetCapitalConfigInputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
  })
  @IsNotEmpty({ message: t('capital.getConfigInput.coopname.required') })
  @IsString({ message: t('capital.getConfigInput.coopname.string') })
  coopname!: string;
}
