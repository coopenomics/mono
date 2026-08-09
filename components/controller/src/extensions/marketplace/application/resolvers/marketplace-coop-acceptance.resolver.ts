import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';

import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import {
  MarketplaceAcceptCppInputDTO,
  MarketplaceCppStatusDTO,
} from '../dto/marketplace-cpp-status.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { MarketplaceCoopAcceptanceService } from '../coop-acceptance/marketplace-coop-acceptance.service';

/**
 * Story 1.9: L1-онбординг marketplace.
 *
 * `Query marketplaceCppStatus` — открыт всем активным пайщикам (нужен фронту,
 * чтобы решить, показывать ли баннер «Не подключено» или открыть рабочее
 * пространство); admin-action для самой mutation идёт через
 * `@RequireMarketplaceAccess('Extension', 'configure')`.
 */
@Resolver()
@Injectable()
export class MarketplaceCoopAcceptanceResolver {
  constructor(private readonly acceptanceService: MarketplaceCoopAcceptanceService) {}

  @Query(() => MarketplaceCppStatusDTO, {
    name: 'marketplaceCppStatus',
    description:
      'Статус принятия положения ЦПП «Стол заказов» Советом кооператива (L1). `active` если принято, `not_accepted` иначе.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceCppStatus(): Promise<MarketplaceCppStatusDTO> {
    const status = await this.acceptanceService.getStatus();
    return new MarketplaceCppStatusDTO(status);
  }

  @Mutation(() => MarketplaceCppStatusDTO, {
    name: 'marketplaceAcceptCpp',
    description:
      'Зафиксировать принятие положения ЦПП «Стол заказов» Советом — admin-action из admin-стола. MVP-stub: председатель самостоятельно передаёт `accepted_by_board_decision_id`; в Эпике 8 поле будет валидироваться против реальной повестки совета.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Extension', 'configure')
  async marketplaceAcceptCpp(
    @Args('input') input: MarketplaceAcceptCppInputDTO
  ): Promise<MarketplaceCppStatusDTO> {
    const status = await this.acceptanceService.accept({
      document_registry_id: input.document_registry_id,
      accepted_by_board_decision_id: input.accepted_by_board_decision_id,
    });
    return new MarketplaceCppStatusDTO(status);
  }
}
