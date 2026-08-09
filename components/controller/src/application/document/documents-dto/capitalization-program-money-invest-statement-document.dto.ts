import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { ExcludeCommonProps } from '~/application/document/types';

type action = Cooperative.Registry.CapitalizationMoneyInvestStatement.Action;

@InputType(`BaseProgramCapitalizationMoneyInvestStatementMetaDocumentInput`)
class BaseProgramCapitalizationMoneyInvestStatementMetaDocumentInputDTO
  implements ExcludeCommonProps<Pick<action, 'amount'>>
{
  @Field({ description: 'Сумма инвестирования в программу (актив)' })
  @IsString()
  @IsNotEmpty()
  amount!: string;
}

/** Вход для генерации заявления 1030 (капитализация / Благорост) без привязки к проекту */
@InputType(`ProgramCapitalizationMoneyInvestStatementGenerateDocumentInput`)
export class ProgramCapitalizationMoneyInvestStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseProgramCapitalizationMoneyInvestStatementMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`ProgramCapitalizationMoneyInvestStatementSignedMetaDocumentInput`)
export class ProgramCapitalizationMoneyInvestStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseProgramCapitalizationMoneyInvestStatementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType(`ProgramCapitalizationMoneyInvestStatementSignedDocumentInput`)
export class ProgramCapitalizationMoneyInvestStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ProgramCapitalizationMoneyInvestStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления об инвестировании в программу благороста (реестр 1030)',
  })
  public readonly meta!: ProgramCapitalizationMoneyInvestStatementSignedMetaDocumentInputDTO;
}
