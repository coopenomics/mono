import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.GenerationContract.Action;

@InputType(`BaseGenerationContractMetaDocumentInput`)
class BaseGenerationContractMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Хэш участника для генерации соглашения' })
  @IsString()
  contributor_hash!: string;
}

@InputType(`GenerationContractGenerateDocumentInput`)
export class GenerationContractGenerateDocumentInputDTO extends IntersectionType(
  BaseGenerationContractMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`GenerationContractSignedMetaDocumentInput`)
export class GenerationContractSignedMetaDocumentInputDTO
  extends IntersectionType(BaseGenerationContractMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`GenerationContractSignedDocumentInput`)
export class GenerationContractSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => GenerationContractSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа договора участия в хозяйственной деятельности',
  })
  public readonly meta!: GenerationContractSignedMetaDocumentInputDTO;
}
