import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * GraphQL DTO для подписания приложения CAPITAL контракта
 * Минимальный набор данных - все остальное подставляется на бэкенде
 */
@InputType('MakeClearanceInput')
export class MakeClearanceInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный документ' })
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;

  @Field(() => String, { description: 'Вклад участника (текстовое описание)', nullable: true })
  @IsString({ message: 'Вклад участника должен быть строкой' })
  contribution?: string;
}
