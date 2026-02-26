import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { SignActAsContributorDomainInput } from '~/extensions/capital/domain/actions/sign-act-as-contributor-domain-input.interface';

/**
 * GraphQL DTO для подписания акта участником CAPITAL контракта
 */
@InputType('SignActAsContributorInput')
export class SignActAsContributorInputDTO implements Omit<SignActAsContributorDomainInput, 'username'> {
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
