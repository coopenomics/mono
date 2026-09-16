import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@coopenomics/innercoop';
import { MarketplaceOrderStatusEnum } from './marketplace-order.dto';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';

export enum MarketplaceOutgoingPaymentRequestStatusEnum {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
}

registerEnumType(MarketplaceOutgoingPaymentRequestStatusEnum, {
  name: 'MarketplaceOutgoingPaymentRequestStatus',
  description:
    'Статус исходящей выплаты поставщику на стороне marketplace. ' +
    'Подтверждение и отказ выполняет общий стол кассира кооператива; ' +
    'marketplace отображает результат только для истории.',
});

@InputType('MarketplaceListOutgoingPaymentsAsSupplierFilterInput')
export class MarketplaceListOutgoingPaymentsAsSupplierFilterInputDTO {
  @Field(() => [MarketplaceOutgoingPaymentRequestStatusEnum], {
    nullable: true,
    description: 'Фильтр по статусам выплат. Пусто — показывать все статусы.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(MarketplaceOutgoingPaymentRequestStatusEnum, { each: true })
  statuses?: MarketplaceOutgoingPaymentRequestStatusEnum[];
}

@InputType('MarketplaceListOutgoingPaymentsFilterInput')
export class MarketplaceListOutgoingPaymentsFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Поставщик-получатель выплаты. Пусто — по всем поставщикам.',
  })
  @IsOptional()
  @IsString()
  supplier_account?: string;

  @Field(() => [MarketplaceOutgoingPaymentRequestStatusEnum], {
    nullable: true,
    description: 'Фильтр по статусам выплат. Пусто — показывать все статусы.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(MarketplaceOutgoingPaymentRequestStatusEnum, { each: true })
  statuses?: MarketplaceOutgoingPaymentRequestStatusEnum[];
}

@ObjectType('MarketplaceOutgoingPaymentRequest')
export class MarketplaceOutgoingPaymentRequestDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String, {
    description: 'Хэш заказа в каталоге поставок — один заказ = одна выплата.',
  })
  order_hash!: string;

  @Field(() => String, { description: 'Идентификатор заказа в каталоге поставок.' })
  order_id!: string;

  @Field(() => String, { description: 'Акт приёмки, по которому возникло обязательство.' })
  apl_reception_id!: string;

  @Field(() => String, { description: 'Аккаунт поставщика — получатель выплаты.' })
  payee_account!: string;

  @Field(() => String, { description: 'Сумма платежа (numeric с 4 знаками).' })
  amount!: string;

  @Field(() => String, { description: 'Символ актива (например, RUB).' })
  symbol!: string;

  @Field(() => String, { description: 'Назначение платежа для распечатки.' })
  purpose!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Куда уходит выплата — короткая подпись реквизитов, например «Сбербанк •1234».',
  })
  payout_destination!: string | null;

  @Field(() => String, {
    description: 'Удержано в счёт признанного гарантийного долга поставщика; сумма к переводу уже уменьшена на неё.',
  })
  withheld_amount!: string;

  @Field(() => MarketplaceOutgoingPaymentRequestStatusEnum)
  status!: MarketplaceOutgoingPaymentRequestStatusEnum;

  @Field(() => Date, { nullable: true })
  completed_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Причина отказа банковского перевода, если кассир отказал в проведении.',
  })
  decline_reason!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Идентификатор транзакции payout / payconfirm — для трассировки в логах.',
  })
  payout_tx_hash!: string | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Идентификатор связанного платежа в общем реестре кооператива — кассир видит ' +
      'выплату в общей ленте платежей.',
  })
  core_payment_id!: string | null;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

export function toMarketplaceOutgoingPaymentRequestDTO(
  e: MarketplaceOutgoingPaymentRequestDomainEntity
): MarketplaceOutgoingPaymentRequestDTO {
  const dto = new MarketplaceOutgoingPaymentRequestDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.order_hash = e.order_hash;
  dto.order_id = e.order_id;
  dto.apl_reception_id = e.apl_reception_id;
  dto.payee_account = e.payee_account;
  dto.amount = e.amount;
  dto.symbol = e.symbol;
  dto.purpose = e.purpose;
  dto.payout_destination = e.payout_destination;
  dto.withheld_amount = e.withheld_amount;
  dto.status = e.status as MarketplaceOutgoingPaymentRequestStatusEnum;
  dto.completed_at = e.completed_at;
  dto.decline_reason = e.decline_reason;
  dto.payout_tx_hash = e.payout_tx_hash;
  dto.core_payment_id = e.core_payment_id;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}

/**
 * Что именно оплачивали: заказ каталога поставок, по которому возникло
 * обязательство. Совет в развороте выплаты должен видеть предмет поставки,
 * а не только сумму и хэш.
 */
@ObjectType('MarketplaceOutgoingPaymentOrderSummary')
export class MarketplaceOutgoingPaymentOrderSummaryDTO {
  @Field(() => String) id!: string;

  @Field(() => String, { nullable: true, description: 'Наименование товара из предложения.' })
  product_name!: string | null;

  @Field(() => Float, { description: 'Заказанный объём.' })
  quantity!: number;

  @Field(() => String, { nullable: true, description: 'Единица измерения объёма.' })
  unit_of_measure!: string | null;

  @Field(() => String, { description: 'Цена за единицу на момент заказа.' })
  price_per_unit!: string;

  @Field(() => String, { description: 'Полная стоимость заказа.' })
  total_cost!: string;

  @Field(() => String, { nullable: true, description: 'Принятая стоимость после приёмки, если отличается.' })
  accepted_cost!: string | null;

  @Field(() => MarketplaceOrderStatusEnum, { description: 'Текущий статус заказа.' })
  status!: MarketplaceOrderStatusEnum;

  @Field(() => String, { nullable: true, description: 'Заказчик — отображаемое имя.' })
  orderer_name!: string | null;

  @Field(() => String, { nullable: true, description: 'Участок доставки — наименование.' })
  delivery_point_name!: string | null;
}

/**
 * Платёж в общем реестре кооператива, которым кассир проводит выплату.
 * Подтверждение оплаты для совета — статус этой записи и дата проведения,
 * а сверху ещё и хэш транзакции в цепи из самой выплаты.
 */
@ObjectType('MarketplaceOutgoingPaymentCoreRecord')
export class MarketplaceOutgoingPaymentCoreRecordDTO {
  @Field(() => String, { nullable: true }) id!: string | null;

  // Перечень статусов платежа общий для кооператива и живёт в кассирском порте
  // (`@coopenomics/innercoop`); в схему его регистрирует ядро под именем
  // `PaymentStatus` — расширение берёт готовый тип, а не заводит свой синоним.
  @Field(() => PaymentStatus, { description: 'Статус платежа в реестре кассира.' })
  status!: PaymentStatus;

  @Field(() => Float, { description: 'Сумма платежа.' })
  quantity!: number;

  @Field(() => String) symbol!: string;

  @Field(() => String, { nullable: true, description: 'Назначение платежа для платёжного поручения.' })
  memo!: string | null;

  @Field(() => String, { nullable: true, description: 'Комментарий кассира — например причина отказа.' })
  message!: string | null;

  @Field(() => Date) created_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Когда кассир провёл платёж.' })
  completed_at!: Date | null;
}

/**
 * Разворот выплаты: сама выплата, оплаченный заказ и запись в реестре кассира.
 * Собирается на бэкенде, чтобы совет не составлял картину из трёх запросов.
 */
@ObjectType('MarketplaceOutgoingPaymentDetail')
export class MarketplaceOutgoingPaymentDetailDTO {
  @Field(() => MarketplaceOutgoingPaymentRequestDTO)
  payment!: MarketplaceOutgoingPaymentRequestDTO;

  @Field(() => MarketplaceOutgoingPaymentOrderSummaryDTO, {
    nullable: true,
    description: 'Заказ, за который платят. Null — заказ не найден (удалён или ещё не доехал).',
  })
  order!: MarketplaceOutgoingPaymentOrderSummaryDTO | null;

  @Field(() => MarketplaceOutgoingPaymentCoreRecordDTO, {
    nullable: true,
    description: 'Платёж в общем реестре кооператива. Null — выплата ещё не заведена кассиру.',
  })
  core_payment!: MarketplaceOutgoingPaymentCoreRecordDTO | null;
}
