import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';

// интерфейс параметров для генерации
type action = Registry.AnnualGeneralMeetingNotification.Action;

@InputType(`BaseAnnualGeneralMeetingNotificationDocumentInput`)
class BaseAnnualGeneralMeetingNotificationDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => String, { description: 'Хеш собрания' })
  @IsString()
  @IsNotEmpty()
  meet_hash!: string;
}
@InputType(`AnnualGeneralMeetingNotificationGenerateDocumentInput`)
export class AnnualGeneralMeetingNotificationGenerateDocumentInputDTO
  extends IntersectionType(
    BaseAnnualGeneralMeetingNotificationDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType(`AnnualGeneralMeetingNotificationSignedMetaDocumentInput`)
export class AnnualGeneralMeetingNotificationSignedMetaDocumentInputDTO
  extends IntersectionType(BaseAnnualGeneralMeetingNotificationDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`AnnualGeneralMeetingNotificationSignedDocumentInput`)
export class AnnualGeneralMeetingNotificationSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => AnnualGeneralMeetingNotificationSignedMetaDocumentInputDTO, {
    description: 'Метаинформация',
  })
  public readonly meta!: AnnualGeneralMeetingNotificationSignedMetaDocumentInputDTO;
}
