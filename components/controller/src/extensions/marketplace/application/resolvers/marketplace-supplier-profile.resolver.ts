import { Inject, Injectable, Optional, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  COOPERATIVE_LOGO_PORT,
  type ICooperativeLogoPort,
} from '@coopenomics/innercoop';
import {
  DomainError,
  GqlJwtAuthGuard,
  platformSettings,
  RequireRight,
  RightsGuard,
  SELF,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceSupplierProfileDTO,
  MarketplaceUpdateSupplierProfileInputDTO,
} from '../dto/marketplace-supplier-profile.dto';
import { MarketplaceUploadCooperativeLogoInputDTO } from '../dto/marketplace-upload-cooperative-logo-input.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import {
  MarketplaceSupplierProfileService,
  type SupplierProfileView,
} from '../services/marketplace-supplier-profile.service';

/**
 * Профиль поставщика: страница, на которой заказчик видит, кто поставщик,
 * сколько у него предложений и как его оценивают. Поставщик правит свой
 * профиль сам, профиль кооператива (имущество со склада) — администратор.
 */
@Resolver()
@Injectable()
export class MarketplaceSupplierProfileResolver {
  constructor(
    private readonly profiles: MarketplaceSupplierProfileService,
    @Optional()
    @Inject(COOPERATIVE_LOGO_PORT)
    private readonly logos: ICooperativeLogoPort | null = null
  ) {}

  @Query(() => MarketplaceSupplierProfileDTO, {
    name: 'marketplaceSupplierProfile',
    description: 'Профиль поставщика: имя, рассказ о себе, обложка, число предложений и сводная оценка.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('SupplierProfile', 'read')
  async marketplaceSupplierProfile(
    @Args('supplier_account', { type: () => String, description: 'Учётная запись поставщика.' })
    supplier_account: string
  ): Promise<MarketplaceSupplierProfileDTO> {
    return this.toDTO(await this.profiles.getProfile(platformSettings().coopname, supplier_account));
  }

  @Mutation(() => MarketplaceSupplierProfileDTO, {
    name: 'marketplaceUpdateMySupplierProfile',
    description: 'Поставщик правит свой профиль: название, рассказ о себе и обложку.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('SupplierProfile', 'update:own', SELF)
  async marketplaceUpdateMySupplierProfile(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUpdateSupplierProfileInputDTO
  ): Promise<MarketplaceSupplierProfileDTO> {
    return this.toDTO(await this.profiles.updateProfile(platformSettings().coopname, member.username, data));
  }

  @Mutation(() => MarketplaceSupplierProfileDTO, {
    name: 'marketplaceUpdateCooperativeProfile',
    description: 'Администратор правит профиль кооператива — поставщика имущества со склада.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('SupplierProfile', 'manage')
  async marketplaceUpdateCooperativeProfile(
    @Args('data') data: MarketplaceUpdateSupplierProfileInputDTO
  ): Promise<MarketplaceSupplierProfileDTO> {
    const { coopname } = platformSettings();
    return this.toDTO(await this.profiles.updateProfile(coopname, coopname, data));
  }

  @Mutation(() => String, {
    name: 'marketplaceUploadCooperativeLogo',
    description: 'Администратор меняет логотип кооператива — файл хранится ядром в настройках узла.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('SupplierProfile', 'manage')
  async marketplaceUploadCooperativeLogo(@Args('data') data: MarketplaceUploadCooperativeLogoInputDTO): Promise<string> {
    if (!this.logos) throw DomainError.badRequest('MARKETPLACE_COOP_LOGO_PORT_UNAVAILABLE');
    return this.logos.upload(data.content_base64, data.mime_type);
  }

  @Mutation(() => Boolean, {
    name: 'marketplaceRemoveCooperativeLogo',
    description: 'Администратор снимает логотип кооператива — в шапке останутся инициалы.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('SupplierProfile', 'manage')
  async marketplaceRemoveCooperativeLogo(): Promise<boolean> {
    if (!this.logos) throw DomainError.badRequest('MARKETPLACE_COOP_LOGO_PORT_UNAVAILABLE');
    await this.logos.remove();
    return true;
  }

  private async toDTO(view: SupplierProfileView): Promise<MarketplaceSupplierProfileDTO> {
    return new MarketplaceSupplierProfileDTO(view, await this.profiles.coverUrl(view.cover));
  }
}
