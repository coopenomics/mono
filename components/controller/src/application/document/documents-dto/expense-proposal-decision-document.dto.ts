import { InputType, Field, IntersectionType, OmitType, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

type Action = Cooperative.Registry.ExpenseProposalDecision.Action;
type ItemAction = Cooperative.Registry.ExpenseProposalStatement.IExpenseItem;
type HeaderAction = Cooperative.Registry.ExpenseProposalStatement.IExpenseProposalHeader;
type DecisionBody = Cooperative.Registry.ExpenseProposalDecision.IExpenseProposalDecisionBody;

@InputType('ExpenseProposalDecisionItemInput')
class ExpenseProposalDecisionItemInputDTO implements ItemAction {
  @Field()
  @IsString()
  number!: string;

  @Field()
  @IsString()
  description!: string;

  @Field()
  @IsString()
  amount!: string;

  @Field()
  @IsString()
  recipient_type!: 'SELF' | 'MEMBER' | 'ORG';

  @Field()
  @IsString()
  mechanics!: 'ADVANCE' | 'DIRECT';
}

@InputType('ExpenseProposalDecisionHeaderInput')
class ExpenseProposalDecisionHeaderInputDTO implements HeaderAction {
  @Field()
  @IsString()
  description!: string;

  @Field()
  @IsString()
  total_amount!: string;

  @Field(() => Int)
  @IsInt()
  items_count!: number;

  @Field()
  @IsString()
  source_wallet!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deadline?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  fund_name?: string;
}

@InputType('ExpenseProposalDecisionBodyInput')
class ExpenseProposalDecisionBodyInputDTO implements DecisionBody {
  @Field({ description: 'Род решения (approve / decline)' })
  @IsString()
  kind!: 'approve' | 'decline';

  @Field({ description: 'Причина отказа (для decline)', nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType('BaseExpenseProposalDecisionMetaDocumentInput')
class BaseExpenseProposalDecisionMetaDocumentInputDTO implements Omit<Action, 'coopname' | 'username' | 'registry_id' | 'block_num' | 'lang' | 'title' | 'generator' | 'version' | 'created_at' | 'timezone' | 'links'> {
  @Field({ description: 'Хеш сметы расхода' })
  @IsString()
  @IsNotEmpty()
  proposal_hash!: string;

  @Field(() => Int, { description: 'Идентификатор решения совета (повестка) — источник данных голосования' })
  @IsInt()
  decision_id!: number;

  @Field(() => ExpenseProposalDecisionHeaderInputDTO, { description: 'Шапка СЗ' })
  @ValidateNested()
  @Type(() => ExpenseProposalDecisionHeaderInputDTO)
  proposal!: ExpenseProposalDecisionHeaderInputDTO;

  @Field(() => [ExpenseProposalDecisionItemInputDTO], { description: 'Позиции расхода' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseProposalDecisionItemInputDTO)
  items!: ExpenseProposalDecisionItemInputDTO[];

  @Field(() => ExpenseProposalDecisionBodyInputDTO, { description: 'Резолюция совета (утвердить / отказать)' })
  @ValidateNested()
  @Type(() => ExpenseProposalDecisionBodyInputDTO)
  resolution!: ExpenseProposalDecisionBodyInputDTO;
}

/**
 * Input генерации документа решения по СЗ (registry 2011).
 */
@InputType('ExpenseProposalDecisionGenerateDocumentInput')
export class ExpenseProposalDecisionGenerateDocumentInputDTO extends IntersectionType(
  BaseExpenseProposalDecisionMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType('ExpenseProposalDecisionSignedMetaDocumentInput')
export class ExpenseProposalDecisionSignedMetaDocumentInputDTO extends IntersectionType(
  BaseExpenseProposalDecisionMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

/**
 * Подписанный документ-решение по СЗ (registry 2011).
 */
@InputType('ExpenseProposalDecisionSignedDocumentInput')
export class ExpenseProposalDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ExpenseProposalDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация решения по СЗ',
  })
  public readonly meta!: ExpenseProposalDecisionSignedMetaDocumentInputDTO;
}
