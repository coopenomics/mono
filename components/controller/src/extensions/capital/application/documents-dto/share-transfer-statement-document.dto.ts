import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

type action = Registry.CapitalizationToMainWalletConvertStatement.Action;

@InputType(`BaseShareTransferStatementMetaDocumentInput`)
class BaseShareTransferStatementMetaDocumentInputDTO implements ExcludeCommonProps<Pick<action, 'amount'>> {
  @Field(() => String, { description: 'Сумма трансляции паевого взноса, с валютой' })
  @IsString()
  @IsNotEmpty()
  amount!: string;
}

/** Вход для генерации заявления о трансляции паевого взноса из Благороста в Цифровой Кошелёк (1090). */
@InputType(`ShareTransferStatementGenerateDocumentInput`)
export class ShareTransferStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseShareTransferStatementMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`ShareTransferStatementSignedMetaDocumentInput`)
export class ShareTransferStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseShareTransferStatementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType(`ShareTransferStatementSignedDocumentInput`)
export class ShareTransferStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ShareTransferStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления о трансляции паевого взноса в Цифровой Кошелёк',
  })
  public readonly meta!: ShareTransferStatementSignedMetaDocumentInputDTO;
}
