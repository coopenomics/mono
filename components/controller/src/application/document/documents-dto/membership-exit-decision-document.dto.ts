import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

// интерфейс параметров для генерации
type action = Cooperative.Registry.DecisionOfParticipantExit.Action;

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
