import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { MarketplaceOutgoingPaymentRequestDomainEntity } from '../../domain/entities/marketplace-outgoing-payment-request.entity';

export enum MarketplaceOutgoingPaymentRequestStatusEnum {
  PENDING_CASHIER_ACTION = 'PENDING_CASHIER_ACTION',
  CONFIRMED_BY_CASHIER = 'CONFIRMED_BY_CASHIER',
  LEDGER_RECORDED = 'LEDGER_RECORDED',
  BLOCKED = 'BLOCKED',
}

registerEnumType(MarketplaceOutgoingPaymentRequestStatusEnum, {
  name: 'MarketplaceOutgoingPaymentRequestStatus',
  description: 'Статус запроса исходящего платежа кассиру.',
});

@ObjectType('MarketplaceOutgoingPaymentRequest')
export class MarketplaceOutgoingPaymentRequestDTO {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => ID, { description: 'Акт приёмки, по которому возникло обязательство.' })
  apl_reception_id!: string;

  @Field(() => String, { description: 'Account поставщика — получатель платежа.' })
  payee_account!: string;

  @Field(() => [ID], { description: 'Заказы, по которым формируется платёж.' })
  related_order_ids!: string[];

  @Field(() => String, { description: 'Сумма платежа (numeric с 4 знаками).' })
  amount!: string;

  @Field(() => String, { description: 'Символ актива (например, RUB).' })
  symbol!: string;

  @Field(() => String, { description: 'Назначение платежа для распечатки.' })
  purpose!: string;

  @Field(() => MarketplaceOutgoingPaymentRequestStatusEnum)
  status!: MarketplaceOutgoingPaymentRequestStatusEnum;

  @Field(() => Date, { nullable: true })
  confirmed_at!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: 'Внешний номер банковского платёжного документа.',
  })
  payment_reference!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Ссылка на выписку банка (URL/hash) для аудита.',
  })
  bank_statement_ref!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Причина блокировки, если платёж не прошёл банковский контур.',
  })
  blocked_reason!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Хэш транзакции o.mkt.payout (для lazy-варианта L12).',
  })
  payout_tx_hash!: string | null;

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('MarketplaceConfirmOutgoingPaymentInput')
export class MarketplaceConfirmOutgoingPaymentInputDTO {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  payment_request_id!: string;

  @Field(() => String, {
    description: 'Номер банковского платёжного поручения / референс операции.',
  })
  @IsString()
  @IsNotEmpty()
  payment_reference!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Опционально — ссылка на выписку банка (URL или hash).',
  })
  @IsOptional()
  @IsString()
  bank_statement_ref?: string;
}

@InputType('MarketplaceBlockOutgoingPaymentInput')
export class MarketplaceBlockOutgoingPaymentInputDTO {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  payment_request_id!: string;

  @Field(() => String, { description: 'Причина блокировки (отказ банка, недостаток средств и т.п.).' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@ObjectType('MarketplaceOutgoingPaymentResult')
export class MarketplaceOutgoingPaymentResultDTO {
  @Field(() => MarketplaceOutgoingPaymentRequestDTO)
  payment_request!: MarketplaceOutgoingPaymentRequestDTO;
}

export function toMarketplaceOutgoingPaymentRequestDTO(
  e: MarketplaceOutgoingPaymentRequestDomainEntity
): MarketplaceOutgoingPaymentRequestDTO {
  const dto = new MarketplaceOutgoingPaymentRequestDTO();
  dto.id = e.id;
  dto.coopname = e.coopname;
  dto.apl_reception_id = e.apl_reception_id;
  dto.payee_account = e.payee_account;
  dto.related_order_ids = e.related_order_ids;
  dto.amount = e.amount;
  dto.symbol = e.symbol;
  dto.purpose = e.purpose;
  dto.status = e.status as MarketplaceOutgoingPaymentRequestStatusEnum;
  dto.confirmed_at = e.confirmed_at;
  dto.payment_reference = e.payment_reference;
  dto.bank_statement_ref = e.bank_statement_ref;
  dto.blocked_reason = e.blocked_reason;
  dto.payout_tx_hash = e.payout_tx_hash;
  dto.created_at = e.created_at;
  dto.updated_at = e.updated_at;
  return dto;
}
