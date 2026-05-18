import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString, IsBoolean } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id' | 'appendix_hash'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.GenerationMoneyInvestStatement.Action;

@InputType(`BaseGenerationConvertStatementMetaDocumentInput`)
class BaseGenerationConvertStatementMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'Хэш проекта' })
  @IsString()
  project_hash!: string;

  @Field({ description: 'Сумма для перевода в Цифровой Кошелёк' })
  @IsString()
  main_wallet_amount!: string;

  @Field({ description: 'Сумма для перевода в программу «Благорост»' })
  @IsString()
  blagorost_wallet_amount!: string;

  @Field({ description: 'Признак перевода в Цифровой Кошелёк' })
  @IsBoolean()
  to_wallet!: boolean;

  @Field({ description: 'Признак перевода в программу «Благорост»' })
  @IsBoolean()
  to_blagorost!: boolean;
}

@InputType(`GenerationConvertStatementGenerateDocumentInput`)
export class GenerationConvertStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseGenerationConvertStatementMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`GenerationConvertStatementSignedMetaDocumentInput`)
export class GenerationConvertStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseGenerationConvertStatementMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {
  @Field({ description: 'Хэш приложения к проекту' })
  @IsString()
  appendix_hash!: string;
}

@InputType(`GenerationConvertStatementSignedDocumentInput`)
export class GenerationConvertStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => GenerationConvertStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа заявления о конвертации целевого паевого взноса',
  })
  public readonly meta!: GenerationConvertStatementSignedMetaDocumentInputDTO;
}
