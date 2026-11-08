import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  createPaginationResult,
  PaginationInputDTO,
  RightsGuard,
  type PaginationResult,
  platformSettings,
  RequireRight,
} from '@coopenomics/extension-kit';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceBranchReserveService } from '../services/marketplace-branch-reserve.service';
import { MarketplacePeriodService } from '../services/marketplace-period.service';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from '../services/marketplace-economy.service';
import { MarketplaceSecureDueService, monthKey } from '../services/marketplace-secure-due.service';
import {
  MarketplaceBranchCurrentPeriodDTO,
  MarketplaceBranchInitiatorDTO,
  MarketplaceBranchPeriodDTO,
  MarketplaceBranchReservesDTO,
  MarketplaceDeleteBranchReserveInputDTO,
  MarketplaceEconomySettingsDTO,
  MarketplaceSetAidLimitInputDTO,
  MarketplaceSetBranchInitiatorInputDTO,
  MarketplaceSetBranchReserveInputDTO,
  MarketplaceSetInitiatorShareInputDTO,
  toMarketplaceBranchPeriodDTO,
  toMarketplaceBranchReservesDTO,
  toMarketplaceEconomySettingsDTO,
} from '../dto/marketplace-keu.dto';
import { periodBounds } from '../shared/period-bounds';

const paginatedBranchPeriods = createPaginationResult(MarketplaceBranchPeriodDTO, 'MarketplaceBranchPeriods');

/**
 * Коэффициент экономического участия (задача 99D-22): настройки модели у
 * администратора, резерв социально-экономического обеспечения пайщиков у
 * председателя участка, итоги месяцев участка для экономики участка.
 *
 * Права — таблица прав Стола заказов: настройки кооператива — `set-fee`,
 * резерв — `configure:chaired-KU`, чтение экономики участка — `read:own-KU`.
 */
@Resolver()
@Injectable()
export class MarketplaceKeuResolver {
  constructor(
    private readonly reserves: MarketplaceBranchReserveService,
    private readonly periods: MarketplacePeriodService,
    private readonly secureDue: MarketplaceSecureDueService,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economyService: MarketplaceEconomyService
  ) {}

  // ── Настройки администратора ───────────────────────────────────────────

  @Query(() => MarketplaceEconomySettingsDTO, {
    name: 'marketplaceGetEconomySettings',
    description:
      'Настройки экономики Стола заказов: ставка обеспечительной части, доля инициатора участка в экономии месяца, потолок резерва социально-экономического обеспечения, проценты фондов накопления.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read')
  async marketplaceGetEconomySettings(): Promise<MarketplaceEconomySettingsDTO> {
    return toMarketplaceEconomySettingsDTO(await this.reserves.getSettings(platformSettings().coopname));
  }

  @Mutation(() => MarketplaceEconomySettingsDTO, {
    name: 'marketplaceSetInitiatorShare',
    description: 'Установить долю инициатора участка в экономии месяца; остальное возвращается пайщикам. Доступно администратору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'set-fee')
  async marketplaceSetInitiatorShare(@Args('data') data: MarketplaceSetInitiatorShareInputDTO): Promise<MarketplaceEconomySettingsDTO> {
    const coopname = platformSettings().coopname;
    await this.reserves.setInitiatorShare(coopname, data.initiator_share_percent);
    return toMarketplaceEconomySettingsDTO(await this.reserves.getSettings(coopname));
  }

  @Mutation(() => MarketplaceEconomySettingsDTO, {
    name: 'marketplaceSetAidLimit',
    description:
      'Установить потолок резерва социально-экономического обеспечения на одного получателя в месяц — один для всех участков. Ноль выключает резерв. Доступно администратору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'set-fee')
  async marketplaceSetAidLimit(@Args('data') data: MarketplaceSetAidLimitInputDTO): Promise<MarketplaceEconomySettingsDTO> {
    const coopname = platformSettings().coopname;
    await this.reserves.setAidLimit(coopname, data.aid_month_limit);
    return toMarketplaceEconomySettingsDTO(await this.reserves.getSettings(coopname));
  }

  @Query(() => MarketplaceBranchInitiatorDTO, {
    name: 'marketplaceGetBranchInitiator',
    description: 'Инициатор кооперативного участка — получатель доли экономии месяца. Без назначения им считается председатель участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'braname' })
  async marketplaceGetBranchInitiator(@Args('braname') braname: string): Promise<MarketplaceBranchInitiatorDTO> {
    const coopname = platformSettings().coopname;
    const initiator = await this.reserves.getBranchInitiator(coopname, braname);
    return { braname, ...initiator };
  }

  @Mutation(() => MarketplaceBranchInitiatorDTO, {
    name: 'marketplaceSetBranchInitiator',
    description: 'Назначить инициатора кооперативного участка отдельно от председателя; пустое имя снимает назначение. Доступно администратору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'set-fee')
  async marketplaceSetBranchInitiator(@Args('data') data: MarketplaceSetBranchInitiatorInputDTO): Promise<MarketplaceBranchInitiatorDTO> {
    const coopname = platformSettings().coopname;
    await this.reserves.setBranchInitiator(coopname, data.braname, data.username ?? null);
    const initiator = await this.reserves.getBranchInitiator(coopname, data.braname);
    return { braname: data.braname, ...initiator };
  }

  // ── Резерв социально-экономического обеспечения пайщиков ─────────────

  @Query(() => MarketplaceBranchReservesDTO, {
    name: 'marketplaceGetBranchReserves',
    description:
      'Резерв социально-экономического обеспечения пайщиков участка: потолок кооператива и строки по получателям с остатком на текущий месяц.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'braname' })
  async marketplaceGetBranchReserves(@Args('braname') braname: string): Promise<MarketplaceBranchReservesDTO> {
    return toMarketplaceBranchReservesDTO(await this.reserves.getReserves(platformSettings().coopname, braname));
  }

  @Mutation(() => MarketplaceBranchReservesDTO, {
    name: 'marketplaceSetBranchReserve',
    description:
      'Записать резерв социально-экономического обеспечения получателю участка на месяц. Доступно председателю участка; сумма не выше потолка кооператива.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceSetBranchReserve(@Args('data') data: MarketplaceSetBranchReserveInputDTO): Promise<MarketplaceBranchReservesDTO> {
    const coopname = platformSettings().coopname;
    await this.reserves.setReserve(coopname, data.braname, data.username, data.amount);
    return toMarketplaceBranchReservesDTO(await this.reserves.getReserves(coopname, data.braname));
  }

  @Mutation(() => MarketplaceBranchReservesDTO, {
    name: 'marketplaceDeleteBranchReserve',
    description: 'Снять резерв социально-экономического обеспечения получателя участка. Доступно председателю участка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'configure:chaired-KU', { ku: 'data.braname' })
  async marketplaceDeleteBranchReserve(@Args('data') data: MarketplaceDeleteBranchReserveInputDTO): Promise<MarketplaceBranchReservesDTO> {
    const coopname = platformSettings().coopname;
    await this.reserves.deleteReserve(coopname, data.braname, data.username);
    return toMarketplaceBranchReservesDTO(await this.reserves.getReserves(coopname, data.braname));
  }

  // ── Итоги месяцев участка ──────────────────────────────────────────────

  @Query(() => paginatedBranchPeriods, {
    name: 'marketplaceListBranchPeriods',
    description:
      'Итоги месяцев кооперативного участка: стоимость списанных заказов, расходы, фонды, доля инициатора, возврат пайщикам, дефицит и коэффициент экономического участия. Новые месяцы первыми.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'braname' })
  async marketplaceListBranchPeriods(
    @Args('braname') braname: string,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchPeriodDTO>> {
    const result = await this.periods.listForBranch(platformSettings().coopname, braname, options);
    return {
      ...result,
      // Границы месяца — по той же шкале, что списание: на стенде со сжатым
      // временем месяц — отрезок STAND_MONTH_SECONDS, его номер годом не читается.
      items: result.items.map((row) => toMarketplaceBranchPeriodDTO(row, this.periods.ratePercentOf(row), periodBounds(row.period, platformSettings().timezone || 'UTC'))),
    };
  }

  @Query(() => MarketplaceBranchCurrentPeriodDTO, {
    name: 'marketplaceGetBranchCurrentPeriod',
    description:
      'Текущий месяц кооперативного участка, идёт: расходы на сегодня, резерв социально-экономического обеспечения пайщиков и заказы, которые созреют к первому числу.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Economy', 'read:own-KU', { ku: 'braname' })
  async marketplaceGetBranchCurrentPeriod(@Args('braname') braname: string): Promise<MarketplaceBranchCurrentPeriodDTO> {
    const coopname = platformSettings().coopname;
    const now = new Date();
    const period = monthKey(now, platformSettings().timezone || 'UTC');
    const [facts, reserves, ripening] = await Promise.all([
      this.periods.collectFacts(coopname, braname, period),
      this.reserves.getReserves(coopname, braname, now),
      this.secureDue.ripeningForBranch(coopname, braname, now),
    ]);
    const reserve = reserves.rows.reduce((sum, r) => sum + this.economyService.assetToUnits(r.amount), 0n);
    const asset = (units: bigint) => this.economyService.unitsToAsset(units);
    const bounds = periodBounds(period, platformSettings().timezone || 'UTC');
    return {
      braname,
      period,
      starts_at: bounds.start,
      ends_at: bounds.end,
      planned: asset(facts.planned),
      memos: asset(facts.memos),
      aid_paid: asset(facts.aidPaid),
      aid_reserve: asset(reserve),
      expenses: asset(facts.planned + facts.memos + reserve),
      ripening_orders: ripening.count,
      ripening_turnover: asset(ripening.turnover),
      ripening_secured: asset(ripening.secured),
    };
  }
}
