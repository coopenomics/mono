import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProgramInvestDomainInput } from '~/extensions/capital/domain/actions/create-program-invest-domain-input.interface';
import { Type } from 'class-transformer';
import { ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/capitalization-program-money-invest-statement-document.dto';

@InputType('CreateProgramInvestInput')
export class CreateProgramInvestInputDTO implements Omit<CreateProgramInvestDomainInput, 'invest_hash'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: 'Имя аккаунта кооператива не должно быть пустым' })
  @IsString({ message: 'Имя аккаунта кооператива должно быть строкой' })
  coopname!: string;

  @Field(() => String, { description: 'Имя инвестора' })
  @IsNotEmpty({ message: 'Имя инвестора не должно быть пустым' })
  @IsString({ message: 'Имя инвестора должно быть строкой' })
  username!: string;

  @Field(() => String, { description: 'Сумма инвестиции' })
  @IsNotEmpty({ message: 'Сумма инвестиции не должна быть пустой' })
  @IsString({ message: 'Сумма инвестиции должна быть строкой' })
  amount!: string;

  @Field(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление (реестр 1030)',
  })
  @Type(() => ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO)
  statement!: ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO;
}
