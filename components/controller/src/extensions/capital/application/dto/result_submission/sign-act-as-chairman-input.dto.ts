import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { SignActAsChairmanDomainInput } from '../../../domain/actions/sign-act-as-chairman-domain-input.interface';
import { SignedDigitalDocumentInputDTO, validationMessage } from '@coopenomics/extension-kit';

/**
 * GraphQL DTO для подписания акта председателем CAPITAL контракта
 */
@InputType('SignActAsChairmanInput')
export class SignActAsChairmanInputDTO implements Omit<SignActAsChairmanDomainInput, 'chairman'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.signActAsChairmanInput.coopname.required') })
  @IsString({ message: validationMessage('capital.signActAsChairmanInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш результата' })
  @IsNotEmpty({ message: validationMessage('capital.signActAsChairmanInput.resultHash.required') })
  @IsString({ message: validationMessage('capital.signActAsChairmanInput.resultHash.string') })
  result_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Акт о вкладе результатов' })
  @Type(() => SignedDigitalDocumentInputDTO)
  act!: SignedDigitalDocumentInputDTO;
}
