import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.ResultContributionAct.Action;

@InputType(`BaseResultContributionActMetaDocumentInput`)
class BaseResultContributionActMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Хэш результата' })
  @IsString()
  result_hash!: string;

  @Field({ description: 'Хэш акта результата' })
  @IsString()
  result_act_hash!: string;

  @Field({ description: 'Процент от результата' })
  @IsString()
  percent_of_result!: string;

  @Field({ description: 'Общая сумма' })
  @IsString()
  total_amount!: string;

  @Field({ description: 'ID решения совета' })
  @IsNumber()
  decision_id!: number;
}

@InputType(`ResultContributionActGenerateDocumentInput`)
export class ResultContributionActGenerateDocumentInputDTO extends IntersectionType(
  BaseResultContributionActMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ResultContributionActSignedMetaDocumentInput`)
export class ResultContributionActSignedMetaDocumentInputDTO
  extends IntersectionType(BaseResultContributionActMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ResultContributionActSignedDocumentInput`)
export class ResultContributionActSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ResultContributionActSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа акта приема-передачи результата',
  })
  public readonly meta!: ResultContributionActSignedMetaDocumentInputDTO;
}
