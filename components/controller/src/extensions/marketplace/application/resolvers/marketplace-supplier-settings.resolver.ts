import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceSetSupplierPayoutMethodInputDTO,
  MarketplaceSupplierPaymentSettingsDTO,
  toMarketplaceSupplierPaymentSettingsDTO,
} from '../dto/marketplace-supplier-settings.dto';
import {
  MARKETPLACE_SUPPLIER_SETTINGS_SERVICE,
  MarketplaceSupplierSettingsService,
} from '../services/marketplace-supplier-settings.service';

/**
 * «Выплаты получаю на…» поставщика: чтение и выбор реквизитов получения
 * выплат. Список доступных реквизитов фронт берёт из ядра (общий API
 * платёжных методов пайщика) — здесь только выбор-ссылка и его резолв.
 */
@Resolver()
@Injectable()
export class MarketplaceSupplierSettingsResolver {
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_SETTINGS_SERVICE)
    private readonly settingsService: MarketplaceSupplierSettingsService
  ) {}

  @Query(() => MarketplaceSupplierPaymentSettingsDTO, {
    name: 'marketplaceGetSupplierPaymentSettings',
    description:
      'Настройки выплат поставщика: выбранные реквизиты и готовность к публикации предложений.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'create:own')
  async marketplaceGetSupplierPaymentSettings(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceSupplierPaymentSettingsDTO> {
    const view = await this.settingsService.getSettings(config.coopname, member.username);
    return toMarketplaceSupplierPaymentSettingsDTO(view);
  }

  @Mutation(() => MarketplaceSupplierPaymentSettingsDTO, {
    name: 'marketplaceSetSupplierPayoutMethod',
    description: 'Поставщик выбирает реквизиты, на которые получает выплаты по актам приёмки.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'create:own')
  async marketplaceSetSupplierPayoutMethod(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSetSupplierPayoutMethodInputDTO
  ): Promise<MarketplaceSupplierPaymentSettingsDTO> {
    const view = await this.settingsService.setPayoutMethod(
      config.coopname,
      member.username,
      input.method_id
    );
    return toMarketplaceSupplierPaymentSettingsDTO(view);
  }
}
