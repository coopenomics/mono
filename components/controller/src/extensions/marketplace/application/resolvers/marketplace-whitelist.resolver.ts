import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAddToWhitelistInputDTO,
  MarketplaceRemoveFromWhitelistInputDTO,
} from '../dto/marketplace-whitelist-input.dto';
import { MarketplaceWhitelistEntryDTO } from '../dto/marketplace-whitelist-entry.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MARKETPLACE_WHITELIST_SERVICE,
  MarketplaceWhitelistService,
} from '../services/marketplace-whitelist.service';

/**
 * Story 3.1: GraphQL endpoints управления whitelist поставщиков.
 *
 * Все 3 операции под `@RequireMarketplaceAccess('Whitelist', 'manage')` —
 * matrix admin'у даёт `Whitelist: ['manage']`, остальным — нет (403).
 */
@Resolver()
@Injectable()
export class MarketplaceWhitelistResolver {
  constructor(
    @Inject(MARKETPLACE_WHITELIST_SERVICE)
    private readonly service: MarketplaceWhitelistService
  ) {}

  @Query(() => [MarketplaceWhitelistEntryDTO], {
    name: 'marketplaceListWhitelist',
    description: 'Список пайщиков-поставщиков, допущенных к публикации оферт',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Whitelist', 'manage')
  async marketplaceListWhitelist(): Promise<MarketplaceWhitelistEntryDTO[]> {
    const entries = await this.service.list(config.coopname);
    return entries.map(
      (e) =>
        new MarketplaceWhitelistEntryDTO({
          id: e.id,
          coopname: e.coopname,
          member_account: e.member_account,
          role: e.role,
          added_by: e.added_by,
          added_at: e.added_at,
        })
    );
  }

  @Mutation(() => MarketplaceWhitelistEntryDTO, {
    name: 'marketplaceAddToWhitelist',
    description: 'Добавить пайщика в whitelist поставщиков (admin)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Whitelist', 'manage')
  async marketplaceAddToWhitelist(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAddToWhitelistInputDTO
  ): Promise<MarketplaceWhitelistEntryDTO> {
    const entry = await this.service.addToWhitelist(
      config.coopname,
      input.member_account,
      currentMember.username
    );
    return new MarketplaceWhitelistEntryDTO({
      id: entry.id,
      coopname: entry.coopname,
      member_account: entry.member_account,
      role: entry.role,
      added_by: entry.added_by,
      added_at: entry.added_at,
    });
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceRemoveFromWhitelist',
    description: 'Удалить пайщика из whitelist (admin); auto-coop запись неудаляема',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Whitelist', 'manage')
  async marketplaceRemoveFromWhitelist(
    @Args('input') input: MarketplaceRemoveFromWhitelistInputDTO
  ): Promise<boolean> {
    await this.service.removeFromWhitelist(config.coopname, input.member_account);
    return true;
  }
}
