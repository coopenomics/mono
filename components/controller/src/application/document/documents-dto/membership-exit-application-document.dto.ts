import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ParticipantExitApplication.Action;

@InputType(`BaseMembershipExitApplicationMetaDocumentInput`)
class BaseMembershipExitApplicationMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({
    description:
      'Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю)',
  })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType(`MembershipExitApplicationGenerateDocumentInput`)
export class MembershipExitApplicationGenerateDocumentInputDTO
  extends IntersectionType(
    BaseMembershipExitApplicationMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`MembershipExitApplicationSignedMetaDocumentInput`)
export class MembershipExitApplicationSignedMetaDocumentInputDTO
  extends IntersectionType(BaseMembershipExitApplicationMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`MembershipExitApplicationSignedDocumentInput`)
export class MembershipExitApplicationSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => MembershipExitApplicationSignedMetaDocumentInputDTO)
  public readonly meta!: MembershipExitApplicationSignedMetaDocumentInputDTO;
}
