import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';
import { IsNotEmpty, IsString } from 'class-validator';

// интерфейс параметров для генерации
type action = Cooperative.Registry.AnnualGeneralMeetingNotification.Action;

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
