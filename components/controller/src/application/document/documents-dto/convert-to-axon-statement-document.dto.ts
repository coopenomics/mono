import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ConvertToAxonStatement.Action;

@InputType(`BaseConvertToAxonStatementMetaDocumentInput`)
class BaseConvertToAxonStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Сумма к конвертации в формате строки' })
  @IsString()
  convert_amount!: string;
}

@InputType(`ConvertToAxonStatementGenerateDocumentInput`)
export class ConvertToAxonStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseConvertToAxonStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`ConvertToAxonStatementSignedMetaDocumentInput`)
export class ConvertToAxonStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseConvertToAxonStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`ConvertToAxonStatementSignedDocumentInput`)
export class ConvertToAxonStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ConvertToAxonStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для заявления на конвертацию',
  })
  public readonly meta!: ConvertToAxonStatementSignedMetaDocumentInputDTO;
}
