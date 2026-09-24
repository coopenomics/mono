import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';
import type { SignActAsContributorDomainInput } from '../../../domain/actions/sign-act-as-contributor-domain-input.interface';

/**
 * GraphQL DTO для подписания акта участником CAPITAL контракта
 */
@InputType('SignActAsContributorInput')
export class SignActAsContributorInputDTO implements Omit<SignActAsContributorDomainInput, 'username'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.signActAsContributorInput.coopname.required') })
  @IsString({ message: validationMessage('capital.signActAsContributorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш результата' })
  @IsNotEmpty({ message: validationMessage('capital.signActAsContributorInput.resultHash.required') })
  @IsString({ message: validationMessage('capital.signActAsContributorInput.resultHash.string') })
  result_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Акт о вкладе результатов' })
  @Type(() => SignedDigitalDocumentInputDTO)
  act!: SignedDigitalDocumentInputDTO;
}
