import { InputType, Field, ObjectType, IntersectionType, OmitType } from '@nestjs/graphql';
import { ValidateNested, IsNotEmpty } from 'class-validator';
import { Cooperative } from 'cooptypes';
import type { GeneratedDocumentDomainInterface } from '~/domain/document/interfaces/generated-document-domain.interface';
import { GenerateMetaDocumentInputDTO } from '~/modules/document/dto/generate-meta-document-input.dto';
import { GeneratedDocumentDTO } from '~/modules/document/dto/generated-document.dto';
import { MetaDocumentInputDTO } from '~/modules/document/dto/meta-document-input.dto';
import { MetaDocumentDTO } from '~/modules/document/dto/meta-document.dto';
import { SignedDigitalDocumentInputDTO } from '~/modules/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/modules/document/types';
import { CommonRequestInputDTO } from './common-request-input.dto';
import { CommonRequestResponseDTO } from './common-request-response.dto';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ReturnByAssetStatement.Action;

@InputType(`BaseReturnByAssetStatementMetaDocumentInput`)
class BaseReturnByAssetStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => CommonRequestInputDTO, { description: 'Запрос на внесение имущественного паевого взноса' })
  @IsNotEmpty()
  @ValidateNested()
  request!: CommonRequestInputDTO;
}

@ObjectType(`BaseReturnByAssetStatementMetaDocumentOutput`)
class BaseReturnByAssetStatementMetaDocumentOutputDTO {
  @Field(() => CommonRequestResponseDTO, { description: 'Запрос на внесение имущественного паевого взноса' })
  @IsNotEmpty()
  @ValidateNested()
  request!: CommonRequestResponseDTO;
}

@InputType(`ReturnByAssetStatementGenerateDocumentInput`)
export class ReturnByAssetStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseReturnByAssetStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ReturnByAssetStatementSignedMetaDocumentInput`)
export class ReturnByAssetStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseReturnByAssetStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ReturnByAssetStatementSignedDocumentInput`)
export class ReturnByAssetStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ReturnByAssetStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания проекта свободного решения',
  })
  public readonly meta!: ReturnByAssetStatementSignedMetaDocumentInputDTO;
}

@ObjectType(`ReturnByAssetStatementMetaDocumentOutput`)
export class ReturnByAssetStatementMetaDocumentOutputDTO extends IntersectionType(
  BaseReturnByAssetStatementMetaDocumentOutputDTO,
  MetaDocumentDTO
) {}

@ObjectType(`ReturnByAssetStatementDocument`)
export class ReturnByAssetStatementDocumentDTO extends GeneratedDocumentDTO implements GeneratedDocumentDomainInterface {
  @Field(() => ReturnByAssetStatementMetaDocumentOutputDTO, {
    description: `Метаинформация для создания проекта свободного решения`,
  })
  @ValidateNested()
  public readonly meta!: ReturnByAssetStatementMetaDocumentOutputDTO;
}
