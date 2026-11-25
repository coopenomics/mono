import { Inject, Injectable } from '@nestjs/common';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import {
  KU_DETAILS_DOMAIN_REPOSITORY,
  type KuDetailsDomainRepository,
} from '../../domain/repositories/ku-details-domain.repository';
import { KuDetailsStatuses, type WorkingHoursDomain } from '../../domain/entities/ku-details-domain.entity';
import { MARKETPLACE_ECONOMY_SERVICE, MarketplaceEconomyService } from './marketplace-economy.service';
import { MarketplaceInvestmentService, type MarketplaceInitiatorTotalsView } from './marketplace-investment.service';

/** Пункт выдачи участка в сводке: режим работы и признак «работает». */
export interface MarketplaceBranchSummaryIssuancePointView {
  working_hours: WorkingHoursDomain;
  active: boolean;
}

/**
 * Сводка участка для пайщика. Раздел пуст (`null`), когда участок в этой части
 * Стола заказов не участвует: не подключён как пункт выдачи, взносов
 * инициаторов нет. Остатки кошельков — asset-строки, итоги инициаторов — в
 * единицах актива.
 */
export interface MarketplaceBranchSummaryView {
  braname: string;
  issuance_point: MarketplaceBranchSummaryIssuancePointView | null;
  common_balance: string;
  social_fund_balance: string;
  initiators: MarketplaceInitiatorTotalsView | null;
}

/** Движение по общему кошельку участка без получателя, заказа и назначения. */
export interface MarketplaceBranchSummaryMovementView {
  global_sequence: string;
  operation_code: string;
  quantity?: string | null;
  created_at: Date;
}

/**
 * Сводка участка для пайщика — то, что Стол заказов показывает на странице
 * кооперативного участка каждому пайщику кооператива: пункт выдачи, кошельки
 * участка и итоги взносов инициаторов.
 *
 * Границы. Сводка только читает и ничего не считает: остатки и итоги берутся
 * из цепи теми же чтениями, что у экономики участка для председателя.
 * Документы, получатели распределения и заказы пайщиков в сводку не входят —
 * они остаются под правом председателя и доверенных лиц участка
 * (`Economy:read:own-KU`). Все чтения точечные: строка пункта выдачи, два
 * кошелька и одна строка участка в таблице взносов.
 */
@Injectable()
export class MarketplaceBranchSummaryService {
  constructor(
    @Inject(KU_DETAILS_DOMAIN_REPOSITORY)
    private readonly kuDetails: KuDetailsDomainRepository,
    @Inject(MARKETPLACE_ECONOMY_SERVICE)
    private readonly economy: MarketplaceEconomyService,
    private readonly investment: MarketplaceInvestmentService
  ) {}

  async getSummary(coopname: string, braname: string): Promise<MarketplaceBranchSummaryView> {
    const [details, balances, initiators] = await Promise.all([
      this.kuDetails.findByCoreBraname(coopname, braname),
      this.economy.getBranchWalletBalances(coopname, braname),
      this.investment.getBranchInitiatorTotals(coopname, braname),
    ]);
    return {
      braname,
      issuance_point: details
        ? { working_hours: details.workingHours, active: details.status === KuDetailsStatuses.ACTIVE }
        : null,
      common_balance: balances.common_balance,
      social_fund_balance: balances.social_fund_balance,
      initiators,
    };
  }

  /**
   * Движения по общему кошельку участка для пайщика: дата, операция и сумма.
   * Источник тот же, что у председателя участка; из записи убраны назначение,
   * заказ и получатель — по ним читаются чужие заказы и выплаты.
   */
  async getMovements(
    coopname: string,
    braname: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<MarketplaceBranchSummaryMovementView>> {
    const history = await this.economy.getBranchWalletHistory(coopname, braname, options);
    return {
      ...history,
      items: history.items.map((item) => ({
        global_sequence: item.global_sequence,
        operation_code: item.operation_code,
        quantity: item.quantity,
        created_at: item.created_at,
      })),
    };
  }
}
