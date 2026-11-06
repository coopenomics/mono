import { InputType, Field, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Registry } from '@coopenomics/docs-templates';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO } from '@coopenomics/extension-kit';
import { ProgramPropertyForm } from '../../domain/enums/program-property-form.enum';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

type statementAction = Registry.CapitalizationPropertyInvestStatement.Action;

/**
 * Позиция имущества паевого взноса в «Благорост» — одна на заявление.
 * Те же поля несут протокол совета (1071) и акт приёма-передачи (1072).
 */
@InputType(`BaseCapitalizationPropertyInvestMetaDocumentInput`)
class BaseCapitalizationPropertyInvestMetaDocumentInputDTO implements ExcludeCommonProps<statementAction> {
  @Field({ description: 'Идентификатор паевого взноса имуществом' })
  @IsString()
  @IsNotEmpty()
  property_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Форма имущества: thing — вещь, intangible — нематериальное имущество (документ, методика, файл)',
  })
  @IsOptional()
  @IsIn(Object.values(ProgramPropertyForm))
  property_form?: string;

  @Field({ description: 'Наименование имущества' })
  @IsString()
  @IsNotEmpty()
  property_name!: string;

  @Field({ description: 'Описание, характеристики и состояние имущества' })
  @IsString()
  @IsNotEmpty()
  property_description!: string;

  @Field({ description: 'Количество' })
  @IsString()
  @IsNotEmpty()
  property_quantity!: string;

  @Field({ description: 'Единица измерения' })
  @IsString()
  @IsNotEmpty()
  property_unit!: string;

  @Field({ description: 'Оценочная стоимость имущества, например «85000.0000 RUB»' })
  @IsString()
  @IsNotEmpty()
  property_amount!: string;
}

@InputType(`CapitalizationPropertyInvestStatementGenerateDocumentInput`)
export class CapitalizationPropertyInvestStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseCapitalizationPropertyInvestMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType(`CapitalizationPropertyInvestStatementSignedMetaDocumentInput`)
export class CapitalizationPropertyInvestStatementSignedMetaDocumentInputDTO
  extends IntersectionType(BaseCapitalizationPropertyInvestMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements statementAction {}

@InputType(`CapitalizationPropertyInvestStatementSignedDocumentInput`)
export class CapitalizationPropertyInvestStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => CapitalizationPropertyInvestStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления о паевом взносе имуществом',
  })
  @Type(() => CapitalizationPropertyInvestStatementSignedMetaDocumentInputDTO)
  public readonly meta!: CapitalizationPropertyInvestStatementSignedMetaDocumentInputDTO;
}

@InputType(`CapitalizationPropertyInvestDecisionGenerateDocumentInput`)
export class CapitalizationPropertyInvestDecisionGenerateDocumentInputDTO extends IntersectionType(
  BaseCapitalizationPropertyInvestMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  @Field(() => Int, { description: 'Номер решения совета' })
  @IsInt()
  decision_id!: number;

  registry_id!: number;

  constructor() {
    super();
  }
}
