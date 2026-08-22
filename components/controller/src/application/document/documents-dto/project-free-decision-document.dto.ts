import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ProjectFreeDecision.Action;

// идентификатор шаблона в реестре документов
const registry_id = Cooperative.Registry.ProjectFreeDecision.registry_id;

@InputType(`BaseProjectFreeDecisionMetaDocumentInput`)
class BaseProjectFreeDecisionMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Идентификатор проекта решения' })
  @IsString()
  project_id!: string;
}

@InputType(`ProjectFreeDecisionGenerateDocumentInput`)
export class ProjectFreeDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseProjectFreeDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id: number;

  constructor() {
    super();
    this.registry_id = registry_id;
  }
}

@InputType(`ProjectFreeDecisionSignedMetaDocumentInput`)
export class ProjectFreeDecisionSignedMetaDocumentInputDTO
  extends IntersectionType(BaseProjectFreeDecisionMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ProjectFreeDecisionSignedDocumentInput`)
export class ProjectFreeDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ProjectFreeDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания проекта свободного решения',
  })
  public readonly meta!: ProjectFreeDecisionSignedMetaDocumentInputDTO;
}
