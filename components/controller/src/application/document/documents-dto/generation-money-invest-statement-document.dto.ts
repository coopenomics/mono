import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id' | 'block_num' | 'lang'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.GenerationMoneyInvestStatement.Action;

@InputType(`BaseGenerationMoneyInvestStatementMetaDocumentInput`)
class BaseGenerationMoneyInvestStatementMetaDocumentInputDTO implements ExcludeCommonProps<Pick<action, 'project_hash' | 'amount'>> {
  @Field({ description: 'Хэш проекта' })
  @IsString()
  @IsNotEmpty()
  project_hash!: string;

  @Field({ description: 'Сумма инвестирования' })
  @IsString()
  @IsNotEmpty()
  amount!: string;
}

@InputType(`GenerationMoneyInvestStatementGenerateDocumentInput`)
export class GenerationMoneyInvestStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseGenerationMoneyInvestStatementMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`GenerationMoneyInvestStatementSignedMetaDocumentInput`)
export class GenerationMoneyInvestStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseGenerationMoneyInvestStatementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {
  @Field({ description: 'Хэш приложения к проекту' })
  @IsString()
  appendix_hash!: string;

  @Field({ description: 'Дата создания приложения к проекту' })
  @IsString()
  appendix_created_at!: string;

  @Field({ description: 'Хэш участника' })
  @IsString()
  contributor_hash!: string;

  @Field({ description: 'Дата создания участника' })
  @IsString()
  contributor_created_at!: string;
}

@InputType(`GenerationMoneyInvestStatementSignedDocumentInput`)
export class GenerationMoneyInvestStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => GenerationMoneyInvestStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа заявления об инвестировании в генерацию',
  })
  public readonly meta!: GenerationMoneyInvestStatementSignedMetaDocumentInputDTO;
}
