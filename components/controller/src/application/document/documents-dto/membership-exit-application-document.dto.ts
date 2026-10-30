import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsBoolean } from 'class-validator';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Registry.ParticipantExitApplication.Action;

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
