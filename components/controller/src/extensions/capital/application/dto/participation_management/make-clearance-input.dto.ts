import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для подписания приложения CAPITAL контракта
 * Минимальный набор данных - все остальное подставляется на бэкенде
 */
@InputType('MakeClearanceInput')
export class MakeClearanceInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.makeClearanceInput.coopname.required') })
  @IsString({ message: t('capital.makeClearanceInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.makeClearanceInput.username.required') })
  @IsString({ message: t('capital.makeClearanceInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.makeClearanceInput.projectHash.required') })
  @IsString({ message: t('capital.makeClearanceInput.projectHash.string') })
  project_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный документ' })
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;

  @Field(() => String, { description: 'Вклад участника (текстовое описание)', nullable: true })
  @IsString({ message: t('capital.makeClearanceInput.contribution.string') })
  contribution?: string;
}
