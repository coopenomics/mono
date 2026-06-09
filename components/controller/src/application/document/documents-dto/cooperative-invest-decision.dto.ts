import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsNumber } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

type action = Cooperative.Registry.CooperativeInvestDecision.Action;

// Сведения об операторе (target_coop_fullname / program_name) при генерации
// заполняет бэкенд из данных кооператива-оператора.
type ExcludeHubProps<T> = Omit<T, 'target_coop_fullname' | 'program_name'>;

@InputType('BaseCooperativeInvestDecisionMetaDocumentInput')
class BaseCooperativeInvestDecisionMetaDocumentInputDTO implements ExcludeHubProps<ExcludeCommonProps<action>> {
  @Field({ description: 'ID решения совета' })
  @IsNumber()
  decision_id!: number;

  @Field({ description: 'Хэш платежа' })
  @IsString()
  payment_hash!: string;

  @Field({ description: 'Сумма инвестирования' })
  @IsString()
  quantity!: string;

  @Field({ description: 'Валюта' })
  @IsString()
  currency!: string;
}

@InputType('CooperativeInvestDecisionGenerateDocumentInput')
export class CooperativeInvestDecisionGenerateDocumentInputDTO extends IntersectionType(
  BaseCooperativeInvestDecisionMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType('CooperativeInvestDecisionSignedMetaDocumentInput')
export class CooperativeInvestDecisionSignedMetaDocumentInputDTO extends IntersectionType(
  BaseCooperativeInvestDecisionMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {
  @Field({ description: 'Полное наименование кооператива-оператора (получателя инвестиции)' })
  @IsString()
  target_coop_fullname!: string;

  @Field({ description: 'Наименование целевой потребительской программы оператора' })
  @IsString()
  program_name!: string;
}

@InputType('CooperativeInvestDecisionSignedDocumentInput')
export class CooperativeInvestDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => CooperativeInvestDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа решения совета об инвестировании средств кооператива в ЦПП оператора',
  })
  public readonly meta!: CooperativeInvestDecisionSignedMetaDocumentInputDTO;
}
