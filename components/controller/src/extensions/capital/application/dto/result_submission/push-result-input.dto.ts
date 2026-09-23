import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { Type } from 'class-transformer';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для внесения результата CAPITAL контракта
 * Принимает подписанное заявление и минимальные данные для идентификации
 */
@InputType('PushResultInput')
export class PushResultInputDTO {
  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.pushResultInput.projectHash.required') })
  @IsString({ message: t('capital.pushResultInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.pushResultInput.username.required') })
  @IsString({ message: t('capital.pushResultInput.username.string') })
  username!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
