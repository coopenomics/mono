import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

// интерфейс параметров для генерации
type action = Cooperative.Registry.AnnualGeneralMeetingSovietDecision.Action;

@InputType(`BaseAnnualGeneralMeetingSovietDecisionDocumentInput`)
class BaseAnnualGeneralMeetingSovietDecisionDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => Number, { description: 'ID решения совета' })
  @IsNumber()
  @IsNotEmpty()
  decision_id!: number;

  @Field(() => String, { description: 'Хеш собрания' })
  @IsString()
  @IsNotEmpty()
  meet_hash!: string;

  @Field(() => Boolean, { description: 'Флаг повторного собрания' })
  @IsBoolean()
  @IsNotEmpty()
  is_repeated!: boolean;
}

@InputType(`AnnualGeneralMeetingSovietDecisionGenerateDocumentInput`)
export class AnnualGeneralMeetingSovietDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseAnnualGeneralMeetingSovietDecisionDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType(`AnnualGeneralMeetingSovietDecisionSignedMetaDocumentInput`)
export class AnnualGeneralMeetingSovietDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseAnnualGeneralMeetingSovietDecisionDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`AnnualGeneralMeetingSovietDecisionSignedDocumentInput`)
export class AnnualGeneralMeetingSovietDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => AnnualGeneralMeetingSovietDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация',
  })
  public readonly meta!: AnnualGeneralMeetingSovietDecisionSignedMetaDocumentInputDTO;
}
