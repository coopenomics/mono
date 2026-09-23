import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProgramInvestDomainInput } from '../../../domain/actions/create-program-invest-domain-input.interface';
import { Type } from 'class-transformer';
import { ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/capitalization-program-money-invest-statement-document.dto';
import { t } from '../../../i18n';

@InputType('CreateProgramInvestInput')
export class CreateProgramInvestInputDTO implements Omit<CreateProgramInvestDomainInput, 'invest_hash'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createProgramInvestInput.coopname.required') })
  @IsString({ message: t('capital.createProgramInvestInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя инвестора' })
  @IsNotEmpty({ message: t('capital.createProgramInvestInput.username.required') })
  @IsString({ message: t('capital.createProgramInvestInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма инвестиции' })
  @IsNotEmpty({ message: t('capital.createProgramInvestInput.amount.required') })
  @IsString({ message: t('capital.createProgramInvestInput.amount.string') })
  amount!: string;

  @Field(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление (реестр 1030)',
  })
  @Type(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO)
  statement!: ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO;
}
