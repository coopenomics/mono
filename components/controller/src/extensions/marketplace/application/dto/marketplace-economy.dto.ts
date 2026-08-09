import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { MarketplaceAidStage } from '../services/marketplace-economy.service';
import type {
  MarketplaceAidView,
  MarketplaceBranchEconomyView,
  MarketplaceBranchWalletOperationView,
  MarketplaceTrusteeWeightView,
} from '../services/marketplace-economy.service';

// ── Конфигурация членского взноса ─────────────────────────────────────

@ObjectType('MarketplaceEconomyConfig', {
  description:
    'Экономика «Стола заказов»: единая ставка членского взноса кооператива (процент от стоимости заказа, одинаковый для всех кооперативных участков).',
})
export class MarketplaceEconomyConfigDTO {
  @Field(() => Float, {
    description: 'Ставка членского взноса, проценты (1.5 = 1,5%). 0 — взнос не начисляется.',
  })
  membership_fee_percent!: number;
}

@InputType('MarketplaceSetMembershipFeeInput')
export class MarketplaceSetMembershipFeeInputDTO {
  @Field(() => Float, {
    description: 'Новая единая ставка членского взноса, проценты (от 0 до 100).',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  membership_fee_percent!: number;
}

// ── Экономика кооперативного участка ──────────────────────────────────

@ObjectType('MarketplaceTrusteeWeight', {
  description: 'Участник распределения членских взносов кооперативного участка.',
})
export class MarketplaceTrusteeWeightDTO {
  @Field({ description: 'Аккаунт председателя или доверенного.' })
  username!: string;

  @Field(() => Int, { description: 'Вес в распределении (доля = вес / сумма весов).' })
  weight!: number;

  @Field(() => Float, { description: 'Доля в персональном распределении, проценты.' })
  share_percent!: number;

  @Field({ description: 'Баланс персонального кошелька участника.' })
  personal_balance!: string;
}

@ObjectType('MarketplaceBranchEconomy', {
  description:
    'Экономика кооперативного участка: общий кошелёк членских взносов, плановые расходы с резервом на 30 дней, веса участников распределения и балансы персональных кошельков.',
})
export class MarketplaceBranchEconomyDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => Int, { description: 'Сумма весов участников распределения.' })
  total_weight!: number;

  @Field(() => [MarketplaceTrusteeWeightDTO], { description: 'Участники распределения и их веса.' })
  weights!: MarketplaceTrusteeWeightDTO[];

  @Field({ description: 'Баланс общего кошелька членских взносов участка.' })
  common_balance!: string;

  @Field({
    description:
      'Плановый резерв расходов ближайших 30 дней: срочные расходы и расходы со сроком внутри горизонта. Эта часть общего кошелька недоступна распределению.',
  })
  reserve_amount!: string;

  @Field({ description: 'Доступно к распределению: общий кошелёк за вычетом резерва.' })
  available_to_distribute!: string;
}

@ObjectType('MarketplaceBranchWalletOperation', {
  description: 'Одно движение по общему кошельку кооперативного участка — поступление членского взноса, изъятие в распределение или оплата планового расхода.',
})
export class MarketplaceBranchWalletOperationDTO {
  @Field({ description: 'Порядковый номер операции в реестре движений.' })
  global_sequence!: string;

  @Field({ description: 'Код операции (поступление членского взноса, распределение между участниками, оплата расхода и т.д.).' })
  operation_code!: string;

  @Field(() => String, { nullable: true, description: 'Сумма движения.' })
  quantity?: string | null;

  @Field(() => String, { nullable: true, description: 'Назначение — например, по какому заказу поступил взнос.' })
  memo?: string | null;

  @Field(() => String, { nullable: true, description: 'Идентификатор заказа-источника — для перехода в реестр заказов участка. Пусто для движений без заказа (распределение, оплата расхода).' })
  order_hash?: string | null;

  @Field(() => String, { nullable: true, description: 'Идентификатор заказа-источника — для перехода на страницу заказа. Пусто для движений без заказа.' })
  order_id?: string | null;

  @Field(() => Date, { description: 'Дата и время операции.' })
  created_at!: Date;
}

@InputType('MarketplaceDistributeBranchFundsInput')
export class MarketplaceDistributeBranchFundsInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => Float, {
    description: 'Сумма распределения из общего кошелька участка (раскладывается по весам).',
  })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceSetTrusteeWeightInput')
export class MarketplaceSetTrusteeWeightInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Аккаунт председателя или доверенного — участника распределения.' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => Int, { description: 'Вес в распределении (целое число больше нуля).' })
  @IsInt()
  @Min(1)
  weight!: number;
}

@InputType('MarketplaceDeleteTrusteeWeightInput')
export class MarketplaceDeleteTrusteeWeightInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Аккаунт участника, исключаемого из распределения.' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

// ── Персональные средства доверенного ─────────────────────────────────

@ObjectType('MarketplacePersonalEconomy', {
  description: 'Персональные членские средства доверенного кооперативного участка.',
})
export class MarketplacePersonalEconomyDTO {
  @Field({ description: 'Баланс персонального кошелька членских средств.' })
  personal_balance!: string;
}

@InputType('MarketplaceConvertBranchFundsInput')
export class MarketplaceConvertBranchFundsInputDTO {
  @Field(() => Float, { description: 'Сумма перевода в членский кошелёк «Стола заказов».' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceAidStatementSignablePayloadInput')
export class MarketplaceAidStatementSignablePayloadInputDTO {
  @Field({ description: 'Кооперативный участок, средства которого распределены получателю.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => Float, { description: 'Сумма материальной помощи.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceCreateAidInput')
export class MarketplaceCreateAidInputDTO {
  @Field({ description: 'Кооперативный участок, средства которого распределены получателю.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => Float, { description: 'Сумма материальной помощи.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @Field({ description: 'Идентификатор заявки (хэш), указанный в подписанном заявлении.' })
  @IsString()
  @IsNotEmpty()
  aid_hash!: string;

  @Field({ description: 'Реквизиты получателя (из раздела «Реквизиты» стола пайщика), на которые уйдёт выплата.' })
  @IsString()
  @IsNotEmpty()
  payment_method_id!: string;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанное получателем Заявление на выплату материальной помощи.',
  })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@ObjectType('MarketplaceAid', {
  description:
    'Заявление на материальную помощь доверенного кооперативного участка. Выплаченные и отклонённые заявления в списке не показываются — итог выплаты виден в движениях по кошельку.',
})
export class MarketplaceAidDTO {
  @Field({ description: 'Идентификатор заявления.' })
  hash!: string;

  @Field({ description: 'Получатель материальной помощи.' })
  username!: string;

  @Field({ description: 'Кооперативный участок, средства которого распределены получателю.' })
  braname!: string;

  @Field({ description: 'Сумма выплаты.' })
  amount!: string;

  @Field(() => MarketplaceAidStage, {
    description:
      'Стадия заявления: на рассмотрении совета либо одобрено советом и ожидает выплаты кассиром.',
  })
  stage!: MarketplaceAidStage;

  @Field(() => PaymentStatusEnum, {
    nullable: true,
    description: 'Статус выплаты у кассира. Пусто — платёж не найден в реестре, обратитесь к администратору.',
  })
  payment_status?: PaymentStatusEnum | null;

  @Field(() => String, { nullable: true, description: 'Реквизиты получателя, на которые уходит выплата (маскированная подпись).' })
  payment_destination?: string | null;
}

@InputType('MarketplaceListAidsInput')
export class MarketplaceListAidsInputDTO {
  @Field({
    nullable: true,
    description: 'Показать заявки только этого получателя (по умолчанию — свои).',
  })
  @IsOptional()
  @IsString()
  username?: string;
}

// ── Мапперы ────────────────────────────────────────────────────────────

export function toMarketplaceBranchEconomyDTO(
  view: MarketplaceBranchEconomyView
): MarketplaceBranchEconomyDTO {
  return {
    braname: view.braname,
    total_weight: view.total_weight,
    weights: view.weights.map((w: MarketplaceTrusteeWeightView) => ({ ...w })),
    common_balance: view.common_balance,
    reserve_amount: view.reserve_amount,
    available_to_distribute: view.available_to_distribute,
  };
}

export function toMarketplaceBranchWalletOperationDTO(
  view: MarketplaceBranchWalletOperationView
): MarketplaceBranchWalletOperationDTO {
  return { ...view };
}

export function toMarketplaceAidDTO(aid: MarketplaceAidView): MarketplaceAidDTO {
  return { ...aid };
}
