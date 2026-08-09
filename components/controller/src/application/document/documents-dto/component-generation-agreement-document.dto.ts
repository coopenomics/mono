import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id' | 'block_num' | 'lang'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.ComponentGenerationContract.Action;

@InputType(`BaseComponentGenerationContractMetaDocumentInput`)
class BaseComponentGenerationContractMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Хэш компонента (проекта)' })
  @IsString()
  @IsNotEmpty()
  component_hash!: string;

  @Field({ description: 'Хэш родительского проекта' })
  @IsString()
  @IsNotEmpty()
  parent_project_hash!: string;
}

@InputType(`ComponentGenerationContractGenerateDocumentInput`)
export class ComponentGenerationContractGenerateDocumentInputDTO extends IntersectionType(
  BaseComponentGenerationContractMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`ComponentGenerationContractSignedMetaDocumentInput`)
export class ComponentGenerationContractSignedMetaDocumentInputDTO extends IntersectionType(
  BaseComponentGenerationContractMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {
  @Field({ description: 'Хэш дополнения к приложению (для компонента)' })
  @IsString()
  appendix_hash!: string;

  @Field({ description: 'Хэш родительского приложения (к родительскому проекту)' })
  @IsString()
  parent_appendix_hash!: string;

  @Field({ description: 'Хэш участника' })
  @IsString()
  contributor_hash!: string;

  @Field({ description: 'Дата создания участника' })
  @IsString()
  contributor_created_at!: string;

  @Field({ description: 'Название компонента' })
  @IsString()
  component_name!: string;

  @Field({ description: 'ID компонента' })
  @IsString()
  component_hash!: string;

  @Field({ description: 'Название проекта' })
  @IsString()
  project_name!: string;

  @Field({ description: 'ID проекта' })
  @IsString()
  project_hash!: string;
}

@InputType(`ComponentGenerationContractSignedDocumentInput`)
export class ComponentGenerationContractSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ComponentGenerationContractSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа дополнения к приложению договора участия в хозяйственной деятельности для компонентов',
  })
  public readonly meta!: ComponentGenerationContractSignedMetaDocumentInputDTO;
}
