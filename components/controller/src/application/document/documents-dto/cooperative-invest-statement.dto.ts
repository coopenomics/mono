import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.CooperativeInvestStatement.Action;

// Сведения об операторе (target_coop_fullname / program_name / payment_details)
// при генерации заполняет бэкенд из данных кооператива-оператора — пайщик их не передаёт.
type ExcludeHubProps<T> = Omit<T, 'target_coop_fullname' | 'program_name' | 'payment_details'>;

@InputType(`BaseCooperativeInvestMetaDocumentInput`)
class BaseCooperativeInvestMetaDocumentInputDTO implements ExcludeHubProps<ExcludeCommonProps<action>> {
  @Field({ description: 'Сумма инвестирования' })
  @IsString()
  quantity!: string;

  @Field({ description: 'Валюта' })
  @IsString()
  currency!: string;

  @Field({ description: 'Хеш платежа для связи с заявкой на инвестирование' })
  @IsString()
  payment_hash!: string;
}

@InputType(`CooperativeInvestStatementGenerateDocumentInput`)
export class CooperativeInvestStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseCooperativeInvestMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`CooperativeInvestStatementSignedMetaDocumentInput`)
export class CooperativeInvestStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseCooperativeInvestMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {
  @Field({ description: 'Полное наименование кооператива-оператора (получателя инвестиции)' })
  @IsString()
  target_coop_fullname!: string;

  @Field({ description: 'Наименование целевой потребительской программы оператора' })
  @IsString()
  program_name!: string;

  @Field({ description: 'Реквизиты оператора и назначение платежа' })
  @IsString()
  payment_details!: string;
}

@InputType(`CooperativeInvestStatementSignedDocumentInput`)
export class CooperativeInvestStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => CooperativeInvestStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа заявления об инвестировании средств кооператива в ЦПП оператора',
  })
  public readonly meta!: CooperativeInvestStatementSignedMetaDocumentInputDTO;
}
