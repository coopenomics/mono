import { InputType, Field, IntersectionType, OmitType, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize, IsInt, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO } from '../document/signed-digital-document-input.dto';
import { MetaDocumentInputDTO } from '../document/meta-document-input.dto';
import { GenerateMetaDocumentInputDTO } from '../document/generate-meta-document-input.dto';

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
  @Field(() => String, { description: 'Порядковый номер строки' })
  @IsString()
  number!: string;

  @Field(() => String, { description: 'Описание расхода' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Сумма строки' })
  @IsString()
  amount!: string;

  @Field(() => String, { description: 'Тип получателя (SELF / MEMBER / ORG)' })
  @IsString()
  recipient_type!: 'SELF' | 'MEMBER' | 'ORG';

  @Field(() => String, { description: 'Способ оплаты (ADVANCE / DIRECT)' })
  @IsString()
  mechanics!: 'ADVANCE' | 'DIRECT';

  @Field(() => String, { description: 'Имя получателя', nullable: true })
  @IsOptional()
  @IsString()
  recipient_name?: string;

  @Field(() => String, { description: 'Реквизиты получателя', nullable: true })
  @IsOptional()
  @IsString()
  requisites?: string;

  @Field(() => String, { description: 'Назначение платежа — отдельной строкой после реквизитов', nullable: true })
  @IsOptional()
  @IsString()
  payment_purpose?: string;

  @Field(() => String, {
    description:
      'Идентификатор сохранённых реквизитов получателя-пайщика — сервер подставит полные реквизиты в документ.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @Field(() => String, {
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
  @Field(() => String, { description: 'Порядковый номер строки' })
  @IsString()
  number!: string;

  @Field(() => String, { description: 'Описание расхода' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Сумма строки' })
  @IsString()
  amount!: string;

  @Field(() => String, { description: 'Тип получателя (SELF / MEMBER / ORG)' })
  @IsString()
  recipient_type!: 'SELF' | 'MEMBER' | 'ORG';

  @Field(() => String, { description: 'Способ оплаты (ADVANCE / DIRECT)' })
  @IsString()
  mechanics!: 'ADVANCE' | 'DIRECT';
}

@InputType('ExpenseProposalHeaderInput')
class ExpenseProposalHeaderInputDTO implements HeaderAction {
  @Field(() => String, { description: 'Описание цели расходов' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Итоговая сумма расходов' })
  @IsString()
  total_amount!: string;

  @Field(() => Int, { description: 'Количество позиций' })
  @IsInt()
  items_count!: number;

  @Field(() => String, { description: 'Кошелёк-источник' })
  @IsString()
  source_wallet!: string;

  // Срок обязателен: он попадает в текст записки, и совет должен видеть,
  // к какой дате расход надо оплатить. Формат проверяем здесь, иначе в
  // документ уходит нечитаемая дата.
  @Field(() => String, { description: 'Срок исполнения («в срок до»), формат DD.MM.YYYY' })
  @IsString()
  @Matches(/^\d{2}\.\d{2}\.\d{4}$/, {
    message: 'Укажите срок исполнения расхода в формате ДД.ММ.ГГГГ',
  })
  deadline!: string;

  @Field(() => String, {
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
  @Field(() => String, { description: 'Хеш сметы расхода (детерминированный)' })
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
  @Field(() => String, { description: 'Хеш сметы расхода (детерминированный)' })
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

  @Field(() => String, { description: 'Идентификатор приватных данных документа off-chain (реквизиты/имя/назначение)' })
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
