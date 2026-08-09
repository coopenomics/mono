import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';

// интерфейс параметров для генерации
type action = Cooperative.Registry.FreeDecision.Action;

@InputType(`BaseFreeDecisionMetaDocumentInput`)
class BaseFreeDecisionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => Number, { description: 'Идентификатор протокола решения собрания совета' })
  @IsNumber()
  decision_id!: number;

  @Field({ description: 'Идентификатор проекта решения' })
  @IsString()
  project_id!: string;
}

@InputType(`FreeDecisionGenerateDocumentInput`)
export class FreeDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseFreeDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType(`FreeDecisionSignedMetaDocumentInput`)
export class FreeDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseFreeDecisionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`FreeDecisionSignedDocumentInput`)
export class FreeDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => FreeDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания протокола решения',
  })
  public readonly meta!: FreeDecisionSignedMetaDocumentInputDTO;
}
