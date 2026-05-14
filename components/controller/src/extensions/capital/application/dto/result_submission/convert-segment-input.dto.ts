import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ConvertSegmentDomainInput } from '~/extensions/capital/domain/actions/convert-segment-domain-input.interface';

/**
 * GraphQL DTO для конвертации сегмента CAPITAL контракта
 */
@InputType('ConvertSegmentInput')
export class ConvertSegmentInputDTO implements ConvertSegmentDomainInput {
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

  @Field(() => String, { description: 'Хэш результата (анкер процесса p.cap.rid)' })
  @IsNotEmpty({ message: 'Хэш результата не должен быть пустым' })
  @IsString({ message: 'Хэш результата должен быть строкой' })
  result_hash!: string;

  @Field(() => String, { description: 'Сумма для конвертации в главный кошелек' })
  @IsNotEmpty({ message: 'Сумма для конвертации в главный кошелек не должна быть пустой' })
  @IsString({ message: 'Сумма для конвертации в главный кошелек должна быть строкой' })
  wallet_amount!: string;

  @Field(() => String, { description: 'Сумма для конвертации в благорост' })
  @IsNotEmpty({ message: 'Сумма для конвертации в благорост не должна быть пустой' })
  @IsString({ message: 'Сумма для конвертации в благорост должна быть строкой' })
  capital_amount!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  convert_statement!: SignedDigitalDocumentInputDTO;
}
