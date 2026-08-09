import { Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';

import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceVitrineDTO } from '../dto/marketplace-vitrine.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_VITRINE_SERVICE,
  MarketplaceVitrineService,
} from '../services/marketplace-vitrine.service';

/**
 * Story 3.1: чтение дефолтной витрины. MVP — одна витрина на кооператив;
 * `Vitrine:['read']` всем marketplace-ролям (orderer/offerer/operator/admin),
 * мутации (manage) — только admin (не реализованы в MVP, Phase 2).
 */
@Resolver()
@Injectable()
export class MarketplaceVitrineResolver {
  constructor(
    @Inject(MARKETPLACE_VITRINE_SERVICE)
    private readonly service: MarketplaceVitrineService
  ) {}

  @Query(() => MarketplaceVitrineDTO, {
    name: 'marketplaceDefaultVitrine',
    description: 'Дефолтная витрина кооператива (MVP — единственная)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Vitrine', 'read')
  async marketplaceDefaultVitrine(): Promise<MarketplaceVitrineDTO> {
    const v = await this.service.getDefault(platformSettings().coopname);
    if (!v) {
      throw new NotFoundException(
        'Дефолтная витрина не найдена — расширение marketplace ещё не bootstrap-нуло данные (нужна миграция v3)'
      );
    }
    return new MarketplaceVitrineDTO({
      id: v.id,
      coopname: v.coopname,
      display_name: v.display_name,
      is_default: v.is_default,
      created_at: v.created_at,
      updated_at: v.updated_at,
    });
  }
}
