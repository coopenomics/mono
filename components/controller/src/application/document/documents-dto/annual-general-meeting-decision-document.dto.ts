import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';

// интерфейс параметров для генерации
type action = Cooperative.Registry.AnnualGeneralMeetingDecision.Action;

@InputType(`BaseAnnualGeneralMeetingDecisionDocumentInput`)
class BaseAnnualGeneralMeetingDecisionDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => String, { description: 'Хеш собрания' })
  @IsString()
  @IsNotEmpty()
  meet_hash!: string;
}

@InputType(`AnnualGeneralMeetingDecisionGenerateDocumentInput`)
export class AnnualGeneralMeetingDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseAnnualGeneralMeetingDecisionDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  @Field(() => String, { description: 'Хеш собрания' })
  @IsString()
  @IsNotEmpty()
  meet_hash!: string;
}

@InputType(`AnnualGeneralMeetingDecisionSignedMetaDocumentInput`)
export class AnnualGeneralMeetingDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseAnnualGeneralMeetingDecisionDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`AnnualGeneralMeetingDecisionSignedDocumentInput`)
export class AnnualGeneralMeetingDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => AnnualGeneralMeetingDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация',
  })
  public readonly meta!: AnnualGeneralMeetingDecisionSignedMetaDocumentInputDTO;
}
