import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { CreateProjectInvestDomainInput } from '../../../domain/actions/create-project-invest-domain-input.interface';
import { Type } from 'class-transformer';
import { GenerationMoneyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/generation-money-invest-statement-document.dto';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для инвестирования в проект CAPITAL контракта
 */
@InputType('CreateProjectInvestInput')
export class CreateProjectInvestInputDTO implements Omit<CreateProjectInvestDomainInput, 'invest_hash'> {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createProjectInvestInput.coopname.required') })
  @IsString({ message: t('capital.createProjectInvestInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.createProjectInvestInput.projectHash.required') })
  @IsString({ message: t('capital.createProjectInvestInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя инвестора' })
  @IsNotEmpty({ message: t('capital.createProjectInvestInput.username.required') })
  @IsString({ message: t('capital.createProjectInvestInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Сумма инвестиции' })
  @IsNotEmpty({ message: t('capital.createProjectInvestInput.amount.required') })
  @IsString({ message: t('capital.createProjectInvestInput.amount.string') })
  amount!: string;

  @Field(() => GenerationMoneyInvestStatementSignedDocumentInputDTO, { description: 'Заявление на инвестирование' })
  @Type(() => GenerationMoneyInvestStatementSignedDocumentInputDTO)
  statement!: GenerationMoneyInvestStatementSignedDocumentInputDTO;
}
