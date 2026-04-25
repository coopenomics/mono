import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';
import { CommonRequestInputDTO } from '../../marketplace/dto/common-request-input.dto';

// интерфейс параметров для генерации
type action = Cooperative.Registry.AssetContributionStatement.Action;

@InputType(`BaseAssetContributionStatementMetaDocumentInput`)
class BaseAssetContributionStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => CommonRequestInputDTO, { description: 'Запрос на внесение имущественного паевого взноса' })
  @IsNotEmpty()
  @ValidateNested()
  request!: CommonRequestInputDTO;
}

@InputType(`AssetContributionStatementGenerateDocumentInput`)
export class AssetContributionStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseAssetContributionStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`AssetContributionStatementSignedMetaDocumentInput`)
export class AssetContributionStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseAssetContributionStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`AssetContributionStatementSignedDocumentInput`)
export class AssetContributionStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => AssetContributionStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания проекта свободного решения',
  })
  public readonly meta!: AssetContributionStatementSignedMetaDocumentInputDTO;
}
