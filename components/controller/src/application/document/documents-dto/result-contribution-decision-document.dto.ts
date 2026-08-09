import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.ResultContributionDecision.Action;

@InputType(`BaseResultContributionDecisionMetaDocumentInput`)
class BaseResultContributionDecisionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'ID решения совета' })
  @IsNumber()
  decision_id!: number;

  @Field({ description: 'Название проекта' })
  @IsString()
  project_name!: string;

  @Field({ description: 'Название компонента' })
  @IsString()
  component_name!: string;

  @Field({ description: 'Хэш результата' })
  @IsString()
  result_hash!: string;

  @Field({ description: 'Процент от результата' })
  @IsString()
  percent_of_result!: string;

  @Field({ description: 'Общая сумма' })
  @IsString()
  total_amount!: string;
}

@InputType(`ResultContributionDecisionGenerateDocumentInput`)
export class ResultContributionDecisionGenerateDocumentInputDTO extends IntersectionType(
  BaseResultContributionDecisionMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ResultContributionDecisionSignedMetaDocumentInput`)
export class ResultContributionDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseResultContributionDecisionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ResultContributionDecisionSignedDocumentInput`)
export class ResultContributionDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ResultContributionDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа решения совета о приеме паевого взноса',
  })
  public readonly meta!: ResultContributionDecisionSignedMetaDocumentInputDTO;
}