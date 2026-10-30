import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Registry.DecisionOfParticipantApplication.Action;

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
