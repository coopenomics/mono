import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import type { SignActAsChairmanDomainInput } from '../../../domain/actions/sign-act-as-chairman-domain-input.interface';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для подписания акта председателем CAPITAL контракта
 */
@InputType('SignActAsChairmanInput')
export class SignActAsChairmanInputDTO implements Omit<SignActAsChairmanDomainInput, 'chairman'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.signActAsChairmanInput.coopname.required') })
  @IsString({ message: t('capital.signActAsChairmanInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш результата' })
  @IsNotEmpty({ message: t('capital.signActAsChairmanInput.resultHash.required') })
  @IsString({ message: t('capital.signActAsChairmanInput.resultHash.string') })
  result_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Акт о вкладе результатов' })
  @Type(() => SignedDigitalDocumentInputDTO)
  act!: SignedDigitalDocumentInputDTO;
}
