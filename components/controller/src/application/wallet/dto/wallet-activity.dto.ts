import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { createPaginationResult } from '@coopenomics/extension-kit';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';

/** Направление движения относительно кошельков пайщика. */
export enum WalletMovementDirection {
  /** Поступление на кошелёк пайщика. */
  IN = 'in',
  /** Списание с кошелька пайщика. */
  OUT = 'out',
  /** Перевод между кошельками самого пайщика. */
  MOVE = 'move',
  /**
   * Шаг процесса пайщика без движения по его кошелькам: выплата возврата
   * паевого взноса из резерва, выплата материальной помощи из фонда.
   */
  PROCESS = 'process',
}
registerEnumType(WalletMovementDirection, {
  name: 'WalletMovementDirection',
  description: 'Направление движения по кошелькам пайщика: поступление, списание, перевод между своими кошельками, шаг процесса без движения по ним',
});

/** Состояние заявки или платежа пайщика, который ещё не исполнен. */
export enum WalletPendingState {
  /** Заявка на выплату ждёт решения совета. */
  COUNCIL_REVIEW = 'council_review',
  /** Совет разрешил, кассир ещё не выплатил. */
  AWAITING_CASHIER = 'awaiting_cashier',
  /** Пополнение ждёт оплаты пайщиком. */
  AWAITING_PAYMENT = 'awaiting_payment',
}
registerEnumType(WalletPendingState, {
  name: 'WalletPendingState',
  description: 'Состояние неисполненной заявки или платежа пайщика: на рассмотрении совета, ожидает кассира, ожидает оплаты',
});

@InputType('GetMyWalletMovementsInput', { description: 'Движения по кошелькам пайщика' })
export class GetMyWalletMovementsInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик, чьи движения читаются' })
  @IsString()
  username!: string;

  @Field(() => String, { nullable: true, description: 'Отбор по одному кошельку пайщика; пусто — все кошельки' })
  @IsOptional()
  @IsString()
  wallet_name?: string;

  @Field(() => Int, { nullable: true, description: 'Страница, с первой' })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @Field(() => Int, { nullable: true, description: 'Строк на странице' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ObjectType('WalletMovement', { description: 'Движение по кошельку пайщика' })
export class WalletMovementDTO {
  @Field(() => String, { description: 'Номер операции учётной книги' })
  global_sequence!: string;

  @Field(() => Date, { description: 'Когда проведена операция' })
  created_at!: Date;

  @Field(() => String, { description: 'Код операции' })
  operation_code!: string;

  @Field(() => String, { description: 'Операция человеческим названием' })
  operation_name!: string;

  @Field(() => String, { nullable: true, description: 'Кошелёк пайщика, по которому прошло движение' })
  wallet_name!: string | null;

  @Field(() => String, { nullable: true, description: 'Название кошелька пайщика' })
  wallet_title!: string | null;

  @Field(() => WalletMovementDirection, { description: 'Направление относительно кошельков пайщика' })
  direction!: WalletMovementDirection;

  @Field(() => String, { description: 'Сумма' })
  quantity!: string;

  @Field(() => String, { nullable: true, description: 'Хэш процесса — открывает документы и операции процесса' })
  process_hash!: string | null;

  @Field(() => String, { nullable: true, description: 'Тип процесса' })
  process_type!: string | null;

  @Field(() => String, { nullable: true, description: 'Пояснение к операции' })
  memo!: string | null;
}

export const PaginatedWalletMovements = createPaginationResult(WalletMovementDTO, 'PaginatedWalletMovements');

@InputType('GetMyPendingPayoutsInput', { description: 'Неисполненные заявки и платежи пайщика' })
export class GetMyPendingPayoutsInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик' })
  @IsString()
  username!: string;
}

@ObjectType('WalletPendingItem', { description: 'Заявка на выплату или платёж пайщика, который ещё не исполнен' })
export class WalletPendingItemDTO {
  @Field(() => String, { description: 'Хэш заявки или платежа — он же хэш процесса' })
  hash!: string;

  @Field(() => PaymentTypeEnum, { description: 'Вид выплаты или платежа' })
  type!: PaymentTypeEnum;

  @Field(() => String, { description: 'Вид выплаты или платежа словами: возврат паевого взноса, материальная помощь, паевой взнос' })
  title!: string;

  @Field(() => WalletPendingState, { description: 'Состояние' })
  state!: WalletPendingState;

  @Field(() => String, { description: 'Сумма' })
  quantity!: string;

  @Field(() => String, { nullable: true, description: 'Реквизиты пайщика, на которые выплата поступит' })
  payment_method_id!: string | null;

  @Field(() => Date, { description: 'Когда подано' })
  created_at!: Date;
}
