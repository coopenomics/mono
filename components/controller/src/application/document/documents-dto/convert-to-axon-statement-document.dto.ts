import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

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
