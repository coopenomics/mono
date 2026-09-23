import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ConvertSegmentDomainInput } from '../../../domain/actions/convert-segment-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для конвертации сегмента CAPITAL контракта
 */
@InputType('ConvertSegmentInput')
export class ConvertSegmentInputDTO implements ConvertSegmentDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.coopname.required') })
  @IsString({ message: t('capital.convertSegmentInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.username.required') })
  @IsString({ message: t('capital.convertSegmentInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.projectHash.required') })
  @IsString({ message: t('capital.convertSegmentInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Хэш результата (анкер процесса p.cap.rid)' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.resultHash.required') })
  @IsString({ message: t('capital.convertSegmentInput.resultHash.string') })
  result_hash!: string;

  @Field(() => String, { description: 'Сумма для конвертации в главный кошелек' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.walletAmount.required') })
  @IsString({ message: t('capital.convertSegmentInput.walletAmount.string') })
  wallet_amount!: string;

  @Field(() => String, { description: 'Сумма для конвертации в благорост' })
  @IsNotEmpty({ message: t('capital.convertSegmentInput.capitalAmount.required') })
  @IsString({ message: t('capital.convertSegmentInput.capitalAmount.string') })
  capital_amount!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление' })
  @Type(() => SignedDigitalDocumentInputDTO)
  convert_statement!: SignedDigitalDocumentInputDTO;
}
