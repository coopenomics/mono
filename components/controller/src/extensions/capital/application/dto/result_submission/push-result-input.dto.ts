import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';
import { Type } from 'class-transformer';

/**
 * GraphQL DTO для внесения результата CAPITAL контракта
 * Принимает подписанное заявление и минимальные данные для идентификации
 */
@InputType('PushResultInput')
export class PushResultInputDTO {
  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.pushResultInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.pushResultInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.pushResultInput.username.required') })
  @IsString({ message: validationMessage('capital.pushResultInput.username.string') })
  username!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
