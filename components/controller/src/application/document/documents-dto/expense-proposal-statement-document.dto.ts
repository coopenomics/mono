import { InputType, Field, IntersectionType, OmitType, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

type Action = Cooperative.Registry.ExpenseProposalStatement.Action;
type ItemAction = Cooperative.Registry.ExpenseProposalStatement.IExpenseItem;
type HeaderAction = Cooperative.Registry.ExpenseProposalStatement.IExpenseProposalHeader;

/**
 * Позиция-вход генерации СЗ-документа. Приватные поля (имя/реквизиты/назначение)
 * — это вход для фабрики: сервер сохраняет их off-chain в doc_data и публикует
 * в meta только `doc_data_hash`. На on-chain эти поля НЕ попадают.
 */
@InputType('ExpenseProposalItemInput')
class ExpenseProposalItemInputDTO {
  @Field({ description: 'Порядковый номер строки' })
  @IsString()
  number!: string;

  @Field({ description: 'Описание расхода' })
  @IsString()
  description!: string;

  @Field({ description: 'Сумма строки' })
  @IsString()
  amount!: string;

  @Field({ description: 'Тип получателя (SELF / MEMBER / ORG)' })
  @IsString()
  recipient_type!: 'SELF' | 'MEMBER' | 'ORG';

  @Field({ description: 'Способ оплаты (ADVANCE / DIRECT)' })
  @IsString()
  mechanics!: 'ADVANCE' | 'DIRECT';

  @Field({ description: 'Имя получателя', nullable: true })
  @IsOptional()
  @IsString()
  recipient_name?: string;

  @Field({ description: 'Реквизиты получателя', nullable: true })
  @IsOptional()
  @IsString()
  requisites?: string;

  @Field({ description: 'Назначение платежа — отдельной строкой после реквизитов', nullable: true })
  @IsOptional()
  @IsString()
  payment_purpose?: string;

  @Field({
    description:
      'Идентификатор сохранённых реквизитов получателя-пайщика — сервер подставит полные реквизиты в документ.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @Field({
    description: 'Имя аккаунта получателя-пайщика (владелец реквизитов).',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  recipient_username?: string;
}

/**
 * Публичная позиция подписанной meta — ровно то, что публикуется on-chain.
 * Без имени/реквизитов/назначения платежа (они off-chain в doc_data).
 */
@InputType('ExpenseProposalSignedItemInput')
class ExpenseProposalSignedItemInputDTO implements ItemAction {
  @Field({ description: 'Порядковый номер строки' })
  @IsString()
  number!: string;

  @Field({ description: 'Описание расхода' })
  @IsString()
  description!: string;

  @Field({ description: 'Сумма строки' })
  @IsString()
  amount!: string;

  @Field({ description: 'Тип получателя (SELF / MEMBER / ORG)' })
  @IsString()
  recipient_type!: 'SELF' | 'MEMBER' | 'ORG';

  @Field({ description: 'Способ оплаты (ADVANCE / DIRECT)' })
  @IsString()
  mechanics!: 'ADVANCE' | 'DIRECT';
}

@InputType('ExpenseProposalHeaderInput')
class ExpenseProposalHeaderInputDTO implements HeaderAction {
  @Field({ description: 'Описание цели расходов' })
  @IsString()
  description!: string;

  @Field({ description: 'Итоговая сумма расходов' })
  @IsString()
  total_amount!: string;

  @Field(() => Int, { description: 'Количество позиций' })
  @IsInt()
  items_count!: number;

  @Field({ description: 'Кошелёк-источник' })
  @IsString()
  source_wallet!: string;

  @Field({ description: 'Срок исполнения («в срок до»), формат DD.MM.YYYY', nullable: true })
  @IsOptional()
  @IsString()
  deadline?: string;

  @Field({
    description: 'Фонд списания — подставляется сервером из параметров шасси расходов, передавать не нужно',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  fund_name?: string;
}

/**
 * База ВХОДА генерации — богатые позиции (приватные поля уйдут в doc_data на
 * сервере). `doc_data_hash` здесь нет: его вычисляет сервер при генерации.
 */
@InputType('BaseExpenseProposalStatementGenerateMetaDocumentInput')
class BaseExpenseProposalStatementGenerateMetaDocumentInputDTO {
  @Field({ description: 'Хеш сметы расхода (детерминированный)' })
  @IsString()
  @IsNotEmpty()
  proposal_hash!: string;

  @Field(() => ExpenseProposalHeaderInputDTO, { description: 'Шапка СЗ' })
  @ValidateNested()
  @Type(() => ExpenseProposalHeaderInputDTO)
  proposal!: ExpenseProposalHeaderInputDTO;

  @Field(() => [ExpenseProposalItemInputDTO], { description: 'Позиции расхода' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseProposalItemInputDTO)
  items!: ExpenseProposalItemInputDTO[];
}

/**
 * База ПОДПИСАННОЙ meta — ровно то, что подписывается и едет on-chain:
 * публичные позиции + `doc_data_hash` (реквизиты off-chain).
 */
@InputType('BaseExpenseProposalStatementSignedMetaDocumentInput')
class BaseExpenseProposalStatementSignedMetaDocumentInputDTO implements Omit<Action, 'coopname' | 'username' | 'registry_id' | 'block_num' | 'lang' | 'title' | 'generator' | 'version' | 'created_at' | 'timezone' | 'links'> {
  @Field({ description: 'Хеш сметы расхода (детерминированный)' })
  @IsString()
  @IsNotEmpty()
  proposal_hash!: string;

  @Field(() => ExpenseProposalHeaderInputDTO, { description: 'Шапка СЗ' })
  @ValidateNested()
  @Type(() => ExpenseProposalHeaderInputDTO)
  proposal!: ExpenseProposalHeaderInputDTO;

  @Field(() => [ExpenseProposalSignedItemInputDTO], { description: 'Публичные позиции расхода (без реквизитов)' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseProposalSignedItemInputDTO)
  items!: ExpenseProposalSignedItemInputDTO[];

  @Field({ description: 'Идентификатор приватных данных документа off-chain (реквизиты/имя/назначение)' })
  @IsString()
  @IsNotEmpty()
  doc_data_hash!: string;
}

/**
 * Input генерации документа СЗ-заявления (registry 2010).
 * Backend через factory собирает PDF, возвращает `IGeneratedDocument` (без подписей).
 */
@InputType('ExpenseProposalStatementGenerateDocumentInput')
export class ExpenseProposalStatementGenerateDocumentInputDTO extends IntersectionType(
  BaseExpenseProposalStatementGenerateMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType('ExpenseProposalStatementSignedMetaDocumentInput')
export class ExpenseProposalStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseExpenseProposalStatementSignedMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

/**
 * Подписанный документ СЗ-заявления (registry 2010).
 */
@InputType('ExpenseProposalStatementSignedDocumentInput')
export class ExpenseProposalStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ExpenseProposalStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация СЗ-заявления',
  })
  public readonly meta!: ExpenseProposalStatementSignedMetaDocumentInputDTO;
}
