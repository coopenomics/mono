import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateDebtDomainInput } from '~/extensions/capital/domain/actions/create-debt-domain-input.interface';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * GraphQL DTO для создания долга CAPITAL контракта
 */
@InputType('CreateDebtInput')
export class CreateDebtInputDTO implements CreateDebtDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: 'Имя пользователя не должно быть пустым' })
  @IsString({ message: 'Имя пользователя должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Хэш долга' })
  @IsNotEmpty({ message: 'Хэш долга не должен быть пустым' })
  @IsString({ message: 'Хэш долга должен быть строкой' })
  debt_hash!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: 'Хэш проекта не должен быть пустым' })
  @IsString({ message: 'Хэш проекта должен быть строкой' })
  project_hash!: string;

  @Field(() => String, { description: 'Сумма долга' })
  @IsNotEmpty({ message: 'Сумма долга не должна быть пустой' })
  @IsString({ message: 'Сумма долга должна быть строкой' })
  amount!: string;

  @Field(() => String, { description: 'Дата возврата' })
  @IsNotEmpty({ message: 'Дата возврата не должна быть пустой' })
  @IsString({ message: 'Дата возврата должна быть строкой' })
  repaid_at!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление на получение ссуды' })
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
