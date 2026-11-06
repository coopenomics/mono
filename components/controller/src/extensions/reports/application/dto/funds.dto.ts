import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { createPaginationResult } from '@coopenomics/extension-kit';

/** Вид фонда: накопления — с процентом отчислений, списания — транзит выплат. */
export enum ReportsFundKind {
  ACCUMULATION = 'accum',
  EXPENDITURE = 'expend',
}
registerEnumType(ReportsFundKind, { name: 'ReportsFundKind', description: 'Вид фонда кооператива: накопления или списания' });

/** Направление движения относительно фонда. */
export enum ReportsFundMovementDirection {
  IN = 'in',
  OUT = 'out',
}
registerEnumType(ReportsFundMovementDirection, {
  name: 'ReportsFundMovementDirection',
  description: 'Направление движения по фонду: поступление или списание',
});

@ObjectType('ReportsFund', { description: 'Фонд кооператива на кошельке учётной книги: настройки, остаток и обороты за период' })
export class ReportsFundDTO {
  @Field(() => Int, { description: 'Номер фонда в реестре (1…5); 0 — справочная строка вне реестра' })
  id!: number;

  @Field(() => ReportsFundKind, { description: 'Вид фонда' })
  kind!: ReportsFundKind;

  @Field(() => String, { description: 'Название фонда по Положению о фондах' })
  name!: string;

  @Field(() => String, { description: 'Описание фонда' })
  description!: string;

  @Field(() => Float, { description: 'Процент отчислений из членских взносов, проценты; у фондов списания 0' })
  percent!: number;

  @Field(() => String, { description: 'Кошелёк учётной книги — субсчёт фонда' })
  wallet!: string;

  @Field(() => String, { description: 'Название кошелька в реестре учётной книги' })
  wallet_name!: string;

  @Field(() => Int, { description: 'Счёт плана счетов, субсчётом которого служит кошелёк (код ×1000)' })
  account!: number;

  @Field(() => String, { description: 'Остаток кошелька фонда' })
  available!: string;

  @Field(() => String, { description: 'Поступления в фонд за период' })
  income!: string;

  @Field(() => String, { description: 'Списания с фонда за период' })
  outcome!: string;
}

@ObjectType('ReportsFundsRegistry', { description: 'Реестр фондов кооператива с остатками и оборотами за период' })
export class ReportsFundsRegistryDTO {
  @Field(() => [ReportsFundDTO], { description: 'Пять стандартных фондов по порядку номеров' })
  funds!: ReportsFundDTO[];
}

@InputType('ReportsFundsInput', { description: 'Запрос реестра фондов за период' })
export class ReportsFundsInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => Date, { nullable: true, description: 'Начало периода оборотов' })
  @IsOptional()
  date_from?: Date;

  @Field(() => Date, { nullable: true, description: 'Конец периода оборотов' })
  @IsOptional()
  date_to?: Date;
}

@ObjectType('ReportsFundMovement', { description: 'Движение по фонду: одна операция учётной книги' })
export class ReportsFundMovementDTO {
  @Field(() => String, { description: 'Номер операции в цепи' })
  global_sequence!: string;

  @Field(() => Int, { description: 'Блок цепи' })
  block_num!: number;

  @Field(() => Date, { description: 'Дата и время операции' })
  created_at!: Date;

  @Field(() => String, { description: 'Код операции учётной книги' })
  operation_code!: string;

  @Field(() => String, { description: 'Название операции' })
  operation_name!: string;

  @Field(() => ReportsFundMovementDirection, { description: 'Поступление в фонд или списание с фонда' })
  direction!: ReportsFundMovementDirection;

  @Field(() => String, { description: 'Сумма со знаком относительно фонда' })
  amount!: string;

  @Field(() => String, { nullable: true, description: 'Кошелёк другой стороны движения; пусто у выплат за пределы кооператива' })
  counterparty_wallet!: string | null;

  @Field(() => String, { nullable: true, description: 'Название кошелька другой стороны' })
  counterparty_name!: string | null;

  @Field(() => String, { nullable: true, description: 'Хэш процесса: заказ, служебная записка, заявление на помощь' })
  process_hash!: string | null;

  @Field(() => String, { nullable: true, description: 'Имя процесса, в нитке которого прошла операция' })
  process_type!: string | null;

  @Field(() => String, { nullable: true, description: 'Пайщик или участок, с которым связана операция' })
  username!: string | null;

  @Field(() => String, { nullable: true, description: 'Примечание операции' })
  memo!: string | null;
}

export const ReportsFundHistoryPaginationResult = createPaginationResult(ReportsFundMovementDTO, 'ReportsFundHistory');

@InputType('ReportsFundHistoryInput', { description: 'Запрос истории движений одного фонда' })
export class ReportsFundHistoryInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'Номер фонда в реестре (1…5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  fund_id!: number;

  @Field(() => Date, { nullable: true, description: 'Начало периода' })
  @IsOptional()
  date_from?: Date;

  @Field(() => Date, { nullable: true, description: 'Конец периода' })
  @IsOptional()
  date_to?: Date;
}

@InputType('ReportsEditFundInput', { description: 'Правка описания и процента фонда председателем совета' })
export class ReportsEditFundInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => Int, { description: 'Номер фонда в реестре (1…5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  fund_id!: number;

  @Field(() => String, { description: 'Описание фонда' })
  @IsString()
  @MaxLength(1000)
  description!: string;

  @Field(() => Float, { description: 'Процент отчислений, проценты; у фонда списания 0' })
  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;
}
