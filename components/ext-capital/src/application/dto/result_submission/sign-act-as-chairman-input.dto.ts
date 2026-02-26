import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { SignActAsChairmanDomainInput } from '~/extensions/capital/domain/actions/sign-act-as-chairman-domain-input.interface';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * GraphQL DTO для подписания акта председателем CAPITAL контракта
 */
@InputType('SignActAsChairmanInput')
export class SignActAsChairmanInputDTO implements Omit<SignActAsChairmanDomainInput, 'chairman'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Хэш результата' })
  @IsNotEmpty({ message: 'Хэш результата не должен быть пустым' })
  @IsString({ message: 'Хэш результата должен быть строкой' })
  result_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Акт о вкладе результатов' })
  @Type(() => SignedDigitalDocumentInputDTO)
  act!: SignedDigitalDocumentInputDTO;
}
