import { Field, GraphQLISODateTime, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { ExpenseCounterpartyKind } from '../../domain/enums/expense-counterparty-kind.enum';
import type {
  ExpenseCounterpartyFormView,
  ExpenseCounterpartyView,
  ExpenseCounterpartyInput,
} from '../services/expense-counterparties.service';

@ObjectType('ExpenseCounterpartyRequisite', { description: 'Реквизит контрагента: подпись и значение.' })
export class ExpenseCounterpartyRequisiteDTO {
  @Field(() => String, { description: 'Ключ реквизита.' })
  key!: string;

  @Field(() => String, { description: 'Подпись реквизита — как в платёжном поручении.' })
  label!: string;

  @Field(() => String, { description: 'Значение реквизита.' })
  value!: string;
}

@ObjectType('ExpenseCounterparty', {
  description: 'Контрагент кооператива — организация или ИП, которым кооператив платит по реквизитам.',
})
export class ExpenseCounterpartyDTO {
  @Field(() => Int, { description: 'Номер контрагента.' })
  id!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, который добавил контрагента; пусто — контрагент кооператива.',
  })
  braname?: string | null;

  @Field(() => ExpenseCounterpartyKind, { description: 'Вид контрагента.' })
  kind!: ExpenseCounterpartyKind;

  @Field(() => String, { description: 'Наименование.' })
  name!: string;

  @Field(() => String, { description: 'Налоговый номер (в России — ИНН).' })
  tax_id!: string;

  @Field(() => [ExpenseCounterpartyRequisiteDTO], { description: 'Реквизиты в порядке платёжного поручения.' })
  requisites!: ExpenseCounterpartyRequisiteDTO[];

  @Field(() => String, { description: 'Реквизиты строкой — как в служебной записке и поручении кассиру.' })
  requisites_text!: string;

  @Field(() => String, { nullable: true, description: 'Назначение платежа по умолчанию.' })
  payment_purpose?: string | null;

  @Field(() => Boolean, { description: 'В архиве: не предлагается для новых расходов.' })
  archived!: boolean;

  @Field(() => String, { description: 'Кто добавил контрагента.' })
  creator!: string;

  @Field(() => GraphQLISODateTime, { description: 'Когда добавлен.' })
  created_at!: Date;

  @Field(() => Boolean, { description: 'Тот, кто спрашивает, вправе править контрагента.' })
  can_manage!: boolean;
}

@ObjectType('ExpenseCounterpartyFormField', { description: 'Поле реквизитов в форме контрагента.' })
export class ExpenseCounterpartyFormFieldDTO {
  @Field(() => String, { description: 'Ключ реквизита.' })
  key!: string;

  @Field(() => String, { description: 'Подпись поля.' })
  label!: string;

  @Field(() => Boolean, { description: 'Поле обязательно.' })
  required!: boolean;

  @Field(() => Int, { nullable: true, description: 'Длина значения в цифрах; пусто — значение не только из цифр.' })
  length?: number | null;

  @Field(() => String, { nullable: true, description: 'Шаблон значения целиком, если оно не только из цифр.' })
  pattern?: string | null;

  @Field(() => String, { nullable: true, description: 'Маска ввода: # — цифра, X — латинская буква или цифра.' })
  mask?: string | null;

  @Field(() => String, { description: 'Раздел формы: organization — сведения об организации, bank — банковские реквизиты.' })
  group!: string;

  @Field(() => Boolean, { description: 'Налоговый номер: по нему заполняются сведения из реестра страны.' })
  tax_id!: boolean;
}

@ObjectType('ExpenseCounterpartyFormKind', { description: 'Поля реквизитов вида контрагента.' })
export class ExpenseCounterpartyFormKindDTO {
  @Field(() => ExpenseCounterpartyKind, { description: 'Вид контрагента.' })
  kind!: ExpenseCounterpartyKind;

  @Field(() => [ExpenseCounterpartyFormFieldDTO], { description: 'Поля в порядке платёжного поручения.' })
  fields!: ExpenseCounterpartyFormFieldDTO[];
}

@ObjectType('ExpenseCounterpartyForm', {
  description: 'Форма контрагента по стране кооператива: какие реквизиты и с какими правилами заполняются.',
})
export class ExpenseCounterpartyFormDTO {
  @Field(() => String, { description: 'Страна кооператива.' })
  country!: string;

  @Field(() => [ExpenseCounterpartyFormKindDTO], { description: 'Поля по видам контрагента.' })
  kinds!: ExpenseCounterpartyFormKindDTO[];
}

@ObjectType('ExpenseCounterpartyRequisiteIssue', { description: 'Нарушение в реквизитах контрагента.' })
export class ExpenseCounterpartyRequisiteIssueDTO {
  @Field(() => String, { description: 'Ключ реквизита.' })
  key!: string;

  @Field(() => String, {
    description: 'REQUIRED — не заполнено, FORMAT — не тот вид или длина, CHECKSUM — не сходится контрольная сумма.',
  })
  code!: string;
}

@InputType('CheckExpenseCounterpartyInput')
export class CheckExpenseCounterpartyInputDTO {
  @Field(() => ExpenseCounterpartyKind, { description: 'Вид контрагента.' })
  @IsEnum(ExpenseCounterpartyKind)
  kind!: ExpenseCounterpartyKind;

  @Field(() => [ExpenseCounterpartyRequisiteInputDTO], { description: 'Реквизиты по полям формы контрагента.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseCounterpartyRequisiteInputDTO)
  requisites!: ExpenseCounterpartyRequisiteInputDTO[];
}

@InputType('ListExpenseCounterpartiesInput')
export class ListExpenseCounterpartiesInputDTO {
  @Field(() => String, { nullable: true, description: 'Поиск по наименованию или налоговому номеру.' })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => Boolean, { nullable: true, description: 'Показать и контрагентов в архиве.' })
  @IsOptional()
  @IsBoolean()
  include_archived?: boolean;
}

@InputType('ExpenseCounterpartyRequisiteInput')
export class ExpenseCounterpartyRequisiteInputDTO {
  @Field(() => String, { description: 'Ключ реквизита — из формы контрагента.' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @Field(() => String, { description: 'Значение реквизита.' })
  @IsString()
  @MaxLength(300)
  value!: string;
}

@InputType('SaveExpenseCounterpartyInput')
export class SaveExpenseCounterpartyInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок, который добавляет контрагента; пусто — контрагент кооператива (добавляет совет).',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => ExpenseCounterpartyKind, { description: 'Вид контрагента.' })
  @IsEnum(ExpenseCounterpartyKind)
  kind!: ExpenseCounterpartyKind;

  @Field(() => String, { description: 'Наименование.' })
  @IsString()
  @MaxLength(500)
  name!: string;

  @Field(() => [ExpenseCounterpartyRequisiteInputDTO], { description: 'Реквизиты по полям формы контрагента.' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseCounterpartyRequisiteInputDTO)
  requisites!: ExpenseCounterpartyRequisiteInputDTO[];

  @Field(() => String, { nullable: true, description: 'Назначение платежа по умолчанию.' })
  @IsOptional()
  @IsString()
  @MaxLength(210)
  payment_purpose?: string;
}

@InputType('UpdateExpenseCounterpartyInput')
export class UpdateExpenseCounterpartyInputDTO extends SaveExpenseCounterpartyInputDTO {
  @Field(() => Int, { description: 'Номер контрагента.' })
  @IsInt()
  @Min(1)
  id!: number;
}

@InputType('ArchiveExpenseCounterpartyInput')
export class ArchiveExpenseCounterpartyInputDTO {
  @Field(() => Int, { description: 'Номер контрагента.' })
  @IsInt()
  @Min(1)
  id!: number;

  @Field(() => Boolean, { description: 'true — убрать в архив, false — вернуть из архива.' })
  @IsBoolean()
  archived!: boolean;
}

@InputType('ExpenseCounterpartyIdInput')
export class ExpenseCounterpartyIdInputDTO {
  @Field(() => Int, { description: 'Номер контрагента.' })
  @IsInt()
  @Min(1)
  id!: number;
}

export function toExpenseCounterpartyDTO(view: ExpenseCounterpartyView): ExpenseCounterpartyDTO {
  return { ...view };
}

export function toExpenseCounterpartyFormDTO(view: ExpenseCounterpartyFormView): ExpenseCounterpartyFormDTO {
  return { ...view };
}

/** Ввод формы → данные сервиса: реквизиты списком «ключ — значение» становятся объектом. */
export function toExpenseCounterpartyInput(data: SaveExpenseCounterpartyInputDTO): ExpenseCounterpartyInput {
  return {
    braname: data.braname ?? null,
    kind: data.kind,
    name: data.name,
    requisites: Object.fromEntries(data.requisites.map((r) => [r.key, r.value])),
    payment_purpose: data.payment_purpose ?? null,
  };
}
