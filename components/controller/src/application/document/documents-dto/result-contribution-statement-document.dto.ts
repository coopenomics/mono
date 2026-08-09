import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.ResultContributionStatement.Action;

@InputType(`BaseResultContributionStatementMetaDocumentInput`)
class BaseResultContributionStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
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

@InputType(`ResultContributionStatementGenerateDocumentInput`)
export class ResultContributionStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseResultContributionStatementMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ResultContributionStatementSignedMetaDocumentInput`)
export class ResultContributionStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseResultContributionStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ResultContributionStatementSignedDocumentInput`)
export class ResultContributionStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ResultContributionStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа заявления о взносе результатов',
  })
  public readonly meta!: ResultContributionStatementSignedMetaDocumentInputDTO;
}