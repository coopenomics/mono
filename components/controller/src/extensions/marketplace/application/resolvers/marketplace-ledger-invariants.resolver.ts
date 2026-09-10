import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MarketplaceLedgerInvariantDTO,
  toMarketplaceLedgerInvariantDTO,
} from '../dto/marketplace-ledger-invariants.dto';
import {
  MARKETPLACE_LEDGER_INVARIANTS_SERVICE,
  type MarketplaceLedgerInvariantsService,
} from '../services/marketplace-ledger-invariants.service';

/**
 * Сверка инвариантов учёта Стола заказов по запросу председателя
 * (задача 99D-14). Тот же прогон, что делает часовой крон, но с выдачей
 * результата на стол.
 */
@Resolver()
@Injectable()
export class MarketplaceLedgerInvariantsResolver {
  constructor(
    @Inject(MARKETPLACE_LEDGER_INVARIANTS_SERVICE)
    private readonly invariants: MarketplaceLedgerInvariantsService
  ) {}

  @Query(() => [MarketplaceLedgerInvariantDTO], {
    name: 'marketplaceLedgerInvariants',
    description:
      'Сверка инвариантов учёта Стола заказов: кошелёк выплат поставщикам, остатки счетов 10, 76, 86 и 91, паевой резерв под заказы. Расхождение указывает на процессы, в которых оно найдено.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Ledger', 'audit')
  async marketplaceLedgerInvariants(): Promise<MarketplaceLedgerInvariantDTO[]> {
    const results = await this.invariants.check(platformSettings().coopname);
    return results.map(toMarketplaceLedgerInvariantDTO);
  }
}
