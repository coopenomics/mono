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
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { BranchContract } from 'cooptypes';
import type {
  MarketplaceBranchEconomyView,
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
    'Экономика кооперативного участка: отсечка персонального распределения, веса участников и балансы кошельков членских взносов.',
})
export class MarketplaceBranchEconomyDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => Float, {
    description:
      'Доля членского взноса, распределяемая персонально между председателем и доверенными, проценты. Остальное — в общий кошелёк участка.',
  })
  personal_percent!: number;

  @Field(() => Int, { description: 'Сумма весов участников распределения.' })
  total_weight!: number;

  @Field(() => [MarketplaceTrusteeWeightDTO], { description: 'Участники распределения и их веса.' })
  weights!: MarketplaceTrusteeWeightDTO[];

  @Field({ description: 'Баланс общего кошелька членских взносов участка.' })
  common_balance!: string;
}

@InputType('MarketplaceSetBranchSplitInput')
export class MarketplaceSetBranchSplitInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => Float, {
    description: 'Доля персонального распределения, проценты (от 0 до 100).',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  personal_percent!: number;
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

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанное получателем Заявление на выплату материальной помощи.',
  })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@ObjectType('MarketplaceAid', {
  description: 'Заявка на материальную помощь доверенного кооперативного участка.',
})
export class MarketplaceAidDTO {
  @Field({ description: 'Идентификатор заявки.' })
  hash!: string;

  @Field({ description: 'Получатель материальной помощи.' })
  username!: string;

  @Field({ description: 'Сумма выплаты.' })
  amount!: string;

  @Field({ description: 'Состояние заявки: ожидает выплаты / выплачена / отклонена.' })
  status!: string;

  @Field({ nullable: true, description: 'Причина отказа (для отклонённых).' })
  decline_reason?: string;
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
    personal_percent: view.personal_percent,
    total_weight: view.total_weight,
    weights: view.weights.map((w: MarketplaceTrusteeWeightView) => ({ ...w })),
    common_balance: view.common_balance,
  };
}

export function toMarketplaceAidDTO(
  aid: BranchContract.Tables.Aids.IBranchAid
): MarketplaceAidDTO {
  return {
    hash: String(aid.hash),
    username: aid.username,
    amount: aid.amount,
    status: aid.status,
    decline_reason: aid.decline_reason || undefined,
  };
}
