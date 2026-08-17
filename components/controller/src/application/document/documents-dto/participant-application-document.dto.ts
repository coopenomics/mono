import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ParticipantApplication.Action;

@InputType(`BaseParticipantApplicationMetaDocumentInput`)
class BaseParticipantApplicationMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Изображение собственноручной подписи (base-64)', nullable: true })
  @IsString()
  signature?: string;

  @Field({ description: 'Имя аккаунта кооперативного участка' })
  @IsOptional()
  braname?: string;

  @Field({
    description:
      'Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю)',
  })
  @IsBoolean()
  skip_save!: boolean;
}

@InputType(`ParticipantApplicationGenerateDocumentInput`)
export class ParticipantApplicationGenerateDocumentInputDTO
  extends IntersectionType(
    BaseParticipantApplicationMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ParticipantApplicationSignedMetaDocumentInput`)
export class ParticipantApplicationSignedMetaDocumentInputDTO
  extends IntersectionType(BaseParticipantApplicationMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ParticipantApplicationSignedDocumentInput`)
export class ParticipantApplicationSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ParticipantApplicationSignedMetaDocumentInputDTO)
  public readonly meta!: ParticipantApplicationSignedMetaDocumentInputDTO;
}
