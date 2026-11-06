import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { MarketplaceBranchPeriodEntity } from '../../infrastructure/entities/marketplace-branch-period.entity';
import type {
  MarketplaceBranchReservesView,
  MarketplaceBranchReserveView,
  MarketplaceEconomySettingsView,
} from '../services/marketplace-branch-reserve.service';

// ── Настройки экономики Стола заказов (стол администратора) ───────────────

@ObjectType('MarketplaceAccumulationFund', { description: 'Фонд накопления кооператива: название, процент отчисления с членского взноса участка и разрез кошелька фондов.' })
export class MarketplaceAccumulationFundDTO {
  @Field({ description: 'Название фонда.' })
  name!: string;

  @Field(() => Float, { description: 'Процент отчисления, проценты.' })
  percent!: number;

  @Field({ description: 'Имя разреза кошелька фондов накопления; пусто до первого отчисления.' })
  wallet_name!: string;
}

@ObjectType('MarketplaceEconomySettings', {
  description:
    'Настройки экономики Стола заказов: ставка обеспечительной части паевого взноса, доля инициатора участка в экономии месяца, потолок резерва социально-экономического обеспечения на получателя в месяц и проценты фондов накопления кооператива.',
})
export class MarketplaceEconomySettingsDTO {
  @Field(() => Float, { description: 'Ставка обеспечительной части паевого взноса, проценты от стоимости заказа.' })
  membership_fee_percent!: number;

  @Field(() => Float, { description: 'Доля инициатора участка в экономии месяца, проценты; остальное возвращается пайщикам.' })
  initiator_share_percent!: number;

  @Field({ description: 'Потолок резерва социально-экономического обеспечения на одного получателя в месяц. Ноль — резерв выключен.' })
  aid_month_limit!: string;

  @Field(() => Float, { description: 'Сумма процентов фондов накопления кооператива, удерживаемых с членского взноса участка.' })
  funds_percent!: number;

  @Field(() => [MarketplaceAccumulationFundDTO], { description: 'Фонды накопления по отдельности.' })
  funds!: MarketplaceAccumulationFundDTO[];
}

@InputType('MarketplaceSetInitiatorShareInput')
export class MarketplaceSetInitiatorShareInputDTO {
  @Field(() => Float, { description: 'Доля инициатора участка в экономии месяца, проценты (от 0 до 100).' })
  @IsNumber()
  @Min(0)
  @Max(100)
  initiator_share_percent!: number;
}

@InputType('MarketplaceSetAidLimitInput')
export class MarketplaceSetAidLimitInputDTO {
  @Field(() => Float, { description: 'Потолок резерва социально-экономического обеспечения на получателя в месяц. Ноль выключает резерв.' })
  @IsNumber()
  @Min(0)
  aid_month_limit!: number;
}

@InputType('MarketplaceSetBranchInitiatorInput')
export class MarketplaceSetBranchInitiatorInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-инициатор участка. Пусто — получателем доли снова становится председатель участка.' })
  @IsOptional()
  @IsString()
  username?: string | null;
}

@ObjectType('MarketplaceBranchInitiator', { description: 'Инициатор кооперативного участка — получатель доли экономии месяца.' })
export class MarketplaceBranchInitiatorDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-инициатор; пусто — у участка нет председателя и назначения.' })
  username!: string | null;

  @Field(() => Boolean, { description: 'Назначен отдельно от председателя участка.' })
  assigned!: boolean;

  @Field({ description: 'Остаток паевого кошелька инициатора участка — доля инициатора в экономии по итогам месяцев.' })
  invest_balance!: string;
}

// ── Резерв социально-экономического обеспечения пайщиков ─────────────────

@ObjectType('MarketplaceBranchReserve', { description: 'Резерв социально-экономического обеспечения одного получателя участка на месяц.' })
export class MarketplaceBranchReserveDTO {
  @Field({ description: 'Получатель — председатель или доверенное лицо участка.' })
  username!: string;

  @Field({ description: 'Резерв в месяц.' })
  amount!: string;

  @Field({ description: 'Подано заявлений на материальную помощь за текущий месяц.' })
  submitted!: string;

  @Field({ description: 'Остаток резерва на текущий месяц.' })
  remaining!: string;
}

@ObjectType('MarketplaceBranchReserves', {
  description: 'Резерв социально-экономического обеспечения пайщиков участка: потолок кооператива и строки по получателям.',
})
export class MarketplaceBranchReservesDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field({ description: 'Потолок резерва на получателя в месяц. Ноль — резерв выключен.' })
  limit!: string;

  @Field(() => [MarketplaceBranchReserveDTO], { description: 'Строки резерва по получателям.' })
  rows!: MarketplaceBranchReserveDTO[];
}

@InputType('MarketplaceSetBranchReserveInput')
export class MarketplaceSetBranchReserveInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Получатель — председатель или доверенное лицо участка.' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => Float, { description: 'Резерв в месяц, не выше потолка кооператива.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceDeleteBranchReserveInput')
export class MarketplaceDeleteBranchReserveInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Получатель, у которого снимается резерв.' })
  @IsString()
  @IsNotEmpty()
  username!: string;
}

// ── Итоги месяцев участка ─────────────────────────────────────────────────

@ObjectType('MarketplaceBranchPeriod', {
  description:
    'Итог месяца кооперативного участка: факты прогона, расчёт контракта и ставки, по которым обеспечительная часть заказов разделена между участком, фондами накопления, инициатором и пайщиками.',
})
export class MarketplaceBranchPeriodDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => Int, { description: 'Номер месяца: год × 12 + месяц по часовому поясу кооператива.' })
  period!: number;

  @Field({ description: 'Стоимость заказов прогона, списанных по итогу месяца.' })
  turnover!: string;

  @Field({ description: 'Собранная обеспечительная часть по заказам прогона.' })
  secured!: string;

  @Field({ description: 'Плановые расходы участка за месяц.' })
  planned!: string;

  @Field({ description: 'Служебные записки участка сверх плана за месяц.' })
  memos!: string;

  @Field({ description: 'Материальная помощь, выплаченная участком за месяц.' })
  aid_paid!: string;

  @Field({ description: 'Резерв социально-экономического обеспечения пайщиков на следующий месяц.' })
  aid_reserve!: string;

  @Field({ description: 'Невыплаченная часть прошлого резерва.' })
  aid_unpaid!: string;

  @Field({ description: 'Расходы участка за прогон.' })
  expenses!: string;

  @Field({ description: 'Членский взнос участка за прогон.' })
  membership!: string;

  @Field({ description: 'В фонды накопления кооператива.' })
  funds_amount!: string;

  @Field({ description: 'Участку на расходы.' })
  branch_amount!: string;

  @Field({ description: 'Инициатору участка.' })
  initiator_amount!: string;

  @Field({ description: 'Пайщикам обратно на свободный паевой.' })
  return_amount!: string;

  @Field({ description: 'Дефицит участка: расходы без покрытия.' })
  deficit!: string;

  @Field({ description: 'Коэффициент экономического участия за месяц, проценты: участку, в фонды и инициатору вместе.' })
  rate_percent!: string;

  @Field({ description: 'Получатель доли инициатора в этом месяце.' })
  initiator!: string;

  @Field(() => Int, { description: 'Заказов в прогоне.' })
  rows_total!: number;

  @Field(() => Int, { description: 'Из них списано.' })
  rows_charged!: number;

  @Field(() => Date, { description: 'Когда рассчитан итог.' })
  closed_at!: Date;

  @Field(() => Boolean, { description: 'Строка уже стёрта из цепи; история хранится здесь.' })
  archived!: boolean;
}

@ObjectType('MarketplaceBranchCurrentPeriod', {
  description:
    'Текущий месяц кооперативного участка, идёт: расходы на сегодня, резерв социально-экономического обеспечения и заказы, которые созреют к первому числу. Ставок нет — итог считает контракт первого числа.',
})
export class MarketplaceBranchCurrentPeriodDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => Int, { description: 'Номер текущего месяца: год × 12 + месяц по часовому поясу кооператива.' })
  period!: number;

  @Field({ description: 'Плановые расходы участка со сроком в текущем месяце.' })
  planned!: string;

  @Field({ description: 'Служебные записки участка сверх плана за текущий месяц.' })
  memos!: string;

  @Field({ description: 'Материальная помощь, выплаченная участком за текущий месяц.' })
  aid_paid!: string;

  @Field({ description: 'Резерв социально-экономического обеспечения пайщиков участка — сумма строк по получателям.' })
  aid_reserve!: string;

  @Field({ description: 'Расходы участка на сегодня: плановые, служебные записки и резерв.' })
  expenses!: string;

  @Field(() => Int, { description: 'Заказов, которые созреют к первому числу.' })
  ripening_orders!: number;

  @Field({ description: 'Стоимость заказов, которые созреют к первому числу.' })
  ripening_turnover!: string;

  @Field({ description: 'Обеспечительная часть по заказам, которые созреют к первому числу.' })
  ripening_secured!: string;
}

// ── Преобразования ────────────────────────────────────────────────────────

export function toMarketplaceEconomySettingsDTO(view: MarketplaceEconomySettingsView): MarketplaceEconomySettingsDTO {
  return { ...view, funds: view.funds.map((f) => ({ ...f })) };
}

export function toMarketplaceBranchReservesDTO(view: MarketplaceBranchReservesView): MarketplaceBranchReservesDTO {
  return { braname: view.braname, limit: view.limit, rows: view.rows.map((r: MarketplaceBranchReserveView) => ({ ...r })) };
}

export function toMarketplaceBranchPeriodDTO(row: MarketplaceBranchPeriodEntity, ratePercent: string): MarketplaceBranchPeriodDTO {
  return {
    braname: row.braname,
    period: row.period,
    turnover: row.turnover,
    secured: row.secured,
    planned: row.planned,
    memos: row.memos,
    aid_paid: row.aid_paid,
    aid_reserve: row.aid_reserve,
    aid_unpaid: row.aid_unpaid,
    expenses: row.expenses,
    membership: row.membership,
    funds_amount: row.funds_amount,
    branch_amount: row.branch_amount,
    initiator_amount: row.initiator_amount,
    return_amount: row.return_amount,
    deficit: row.deficit,
    rate_percent: ratePercent,
    initiator: row.initiator,
    rows_total: row.rows_total,
    rows_charged: row.rows_charged,
    closed_at: row.closed_at,
    archived: row.deleted_at !== null,
  };
}
