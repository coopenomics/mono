import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProgramInvestDomainInput } from '../../../domain/actions/create-program-invest-domain-input.interface';
import { Type } from 'class-transformer';
import { ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/capitalization-program-money-invest-statement-document.dto';

@InputType('CreateProgramInvestInput')
export class CreateProgramInvestInputDTO implements Omit<CreateProgramInvestDomainInput, 'invest_hash'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramInvestInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProgramInvestInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя инвестора' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramInvestInput.username.required') })
  @IsString({ message: validationMessage('capital.createProgramInvestInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма инвестиции' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramInvestInput.amount.required') })
  @IsString({ message: validationMessage('capital.createProgramInvestInput.amount.string') })
  amount!: string;

  @Field(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление (реестр 1030)',
  })
  @Type(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO)
  statement!: ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO;
}
