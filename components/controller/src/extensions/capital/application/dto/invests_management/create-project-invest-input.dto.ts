import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProjectInvestDomainInput } from '../../../domain/actions/create-project-invest-domain-input.interface';
import { Type } from 'class-transformer';
import { GenerationMoneyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/generation-money-invest-statement-document.dto';

/**
 * GraphQL DTO для инвестирования в проект CAPITAL контракта
 */
@InputType('CreateProjectInvestInput')
export class CreateProjectInvestInputDTO implements Omit<CreateProjectInvestDomainInput, 'invest_hash'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInvestInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProjectInvestInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInvestInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.createProjectInvestInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя инвестора' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInvestInput.username.required') })
  @IsString({ message: validationMessage('capital.createProjectInvestInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма инвестиции' })
  @IsNotEmpty({ message: validationMessage('capital.createProjectInvestInput.amount.required') })
  @IsString({ message: validationMessage('capital.createProjectInvestInput.amount.string') })
  amount!: string;

  @Field(() => GenerationMoneyInvestStatementSignedDocumentInputDTO, { description: 'Заявление на инвестирование' })
  @Type(() => GenerationMoneyInvestStatementSignedDocumentInputDTO)
  statement!: GenerationMoneyInvestStatementSignedDocumentInputDTO;
}
