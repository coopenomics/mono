import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';

/**
 * GraphQL DTO для подписания приложения CAPITAL контракта
 * Минимальный набор данных - все остальное подставляется на бэкенде
 */
@InputType('MakeClearanceInput')
export class MakeClearanceInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.makeClearanceInput.coopname.required') })
  @IsString({ message: validationMessage('capital.makeClearanceInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.makeClearanceInput.username.required') })
  @IsString({ message: validationMessage('capital.makeClearanceInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.makeClearanceInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.makeClearanceInput.projectHash.string') })
  project_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный документ' })
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;

  @Field(() => String, { description: 'Вклад участника (текстовое описание)', nullable: true })
  @IsString({ message: validationMessage('capital.makeClearanceInput.contribution.string') })
  contribution?: string;
}
