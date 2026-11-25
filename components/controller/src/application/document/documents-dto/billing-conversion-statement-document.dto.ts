import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации (registry_id = 1095)
type action = Registry.BillingConversionStatement.Action;

@InputType(`BaseBillingConversionStatementMetaDocumentInput`)
class BaseBillingConversionStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Сумма к конвертации паевого в членский на биллинг-кошелёк' })
  @IsString()
  convert_amount!: string;
}

@InputType(`BillingConversionStatementGenerateDocumentInput`)
export class BillingConversionStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBillingConversionStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`BillingConversionStatementSignedMetaDocumentInput`)
export class BillingConversionStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseBillingConversionStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType(`BillingConversionStatementSignedDocumentInput`)
export class BillingConversionStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BillingConversionStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления на конвертацию паевого в биллинг-кошелёк',
  })
  public readonly meta!: BillingConversionStatementSignedMetaDocumentInputDTO;
}
