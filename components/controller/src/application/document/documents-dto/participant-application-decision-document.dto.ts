import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';

// интерфейс параметров для генерации
type action = Cooperative.Registry.DecisionOfParticipantApplication.Action;

@InputType(`BaseParticipantApplicationDecisionMetaDocumentInput`)
class BaseParticipantApplicationDecisionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор протокола решения собрания совета' })
  @IsNumber()
  decision_id!: number;
}

@InputType(`ParticipantApplicationDecisionGenerateDocumentInput`)
export class ParticipantApplicationDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseParticipantApplicationDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ParticipantApplicationDecisionSignedMetaDocumentInput`)
export class ParticipantApplicationDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseParticipantApplicationDecisionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ParticipantApplicationDecisionSignedDocumentInput`)
export class ParticipantApplicationDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ParticipantApplicationDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания проекта свободного решения',
  })
  public readonly meta!: ParticipantApplicationDecisionSignedMetaDocumentInputDTO;
}
