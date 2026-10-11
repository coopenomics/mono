import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  platformSettings,
  RequireRight,
  RightsGuard,
  SELF,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import {
  MarketplaceHandoffCodeDTO,
  MarketplaceHandoffCodeInputDTO,
  MarketplaceResolveScanInputDTO,
  MarketplaceScanVisitDTO,
} from '../dto/marketplace-scan.dto';
import { MarketplaceScanService } from '../services/marketplace-scan.service';

@Resolver()
@Injectable()
export class MarketplaceScanResolver {
  constructor(private readonly scan: MarketplaceScanService) {}

  @Query(() => MarketplaceScanVisitDTO, {
    name: 'marketplaceResolveScan',
    description:
      'Визит на участок по отсканированному коду: кто пришёл и какие дела у него на этом участке — выдача заказов, приёмка поставки, осмотр возврата. Код партии и код бокса ведут к предмету.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Warehouse', 'read:own-KU', { ku: 'data.braname' })
  async marketplaceResolveScan(
    @Args('data') data: MarketplaceResolveScanInputDTO
  ): Promise<MarketplaceScanVisitDTO> {
    return this.scan.resolveVisit(platformSettings().coopname, data.braname, data.code);
  }

  @Query(() => MarketplaceHandoffCodeDTO, {
    name: 'marketplaceHandoffCode',
    description: 'Код передачи пайщика для показа оператору участка: на получение заказов или на приёмку поставки.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Onboarding', 'read:own', SELF)
  async marketplaceHandoffCode(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceHandoffCodeInputDTO
  ): Promise<MarketplaceHandoffCodeDTO> {
    return this.scan.handoffCodeFor(platformSettings().coopname, member.username, data.kind);
  }
}
