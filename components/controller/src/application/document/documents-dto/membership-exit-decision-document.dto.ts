import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Registry.DecisionOfParticipantExit.Action;

@InputType(`BaseMembershipExitDecisionMetaDocumentInput`)
class BaseMembershipExitDecisionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор протокола решения собрания совета' })
  @IsNumber()
  decision_id!: number;
}

@InputType(`MembershipExitDecisionGenerateDocumentInput`)
export class MembershipExitDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMembershipExitDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`MembershipExitDecisionSignedMetaDocumentInput`)
export class MembershipExitDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMembershipExitDecisionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`MembershipExitDecisionSignedDocumentInput`)
export class MembershipExitDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MembershipExitDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация решения собрания совета о выходе пайщика',
  })
  public readonly meta!: MembershipExitDecisionSignedMetaDocumentInputDTO;
}
