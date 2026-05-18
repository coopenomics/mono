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
  MarketplaceInventoryItemDTO,
  MarketplaceLabelInventoryInputDTO,
  MarketplaceLabelInventoryResultDTO,
  MarketplaceListInventoryInputDTO,
  toMarketplaceInventoryItemDTO,
} from '../dto/marketplace-inventory.dto';
import {
  MARKETPLACE_INVENTORY_LABEL_SERVICE,
  MarketplaceInventoryLabelService,
} from '../services/marketplace-inventory-label.service';
import {
  MARKETPLACE_INVENTORY_REPOSITORY,
  type MarketplaceInventoryDomainRepository,
  type MarketplaceInventoryListFilter,
} from '../../domain/repositories/marketplace-inventory.repository';
import type {
  MarketplaceBarcodeFormat,
  MarketplaceBarcodeStrategy,
  MarketplaceInventoryStatus,
} from '../../domain/entities/marketplace-inventory.types';

@Resolver()
@Injectable()
export class MarketplaceInventoryResolver {
  constructor(
    @Inject(MARKETPLACE_INVENTORY_LABEL_SERVICE)
    private readonly labelService: MarketplaceInventoryLabelService,
    @Inject(MARKETPLACE_INVENTORY_REPOSITORY)
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository
  ) {}

  @Mutation(() => MarketplaceLabelInventoryResultDTO, {
    name: 'marketplaceLabelInventory',
    description:
      'Оператор КУ маркирует имущество заказа внутренним штрих-кодом (Code128 или EAN-13).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceLabelInventory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceLabelInventoryInputDTO
  ): Promise<MarketplaceLabelInventoryResultDTO> {
    const result = await this.labelService.execute({
      coopname: config.coopname,
      operator_account: member.username,
      order_id: data.order_id,
      strategy: data.strategy as unknown as MarketplaceBarcodeStrategy | undefined,
      format: data.format as unknown as MarketplaceBarcodeFormat | undefined,
      pack_size: data.pack_size,
    });
    const dto = new MarketplaceLabelInventoryResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    return dto;
  }

  @Query(() => [MarketplaceInventoryItemDTO], {
    name: 'marketplaceListInventory',
    description: 'Список наклеек инвентаря КУ — для admin-стола склада и операторских разделов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Warehouse', 'read:own-KU')
  async marketplaceListInventory(
    @CurrentMarketplaceMember() _member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListInventoryInputDTO
  ): Promise<MarketplaceInventoryItemDTO[]> {
    const filter: MarketplaceInventoryListFilter = {
      coopname: config.coopname,
      order_id: data?.order_id,
      shipment_id: data?.shipment_id,
      braname: data?.braname,
      status: data?.statuses?.length
        ? (data.statuses as MarketplaceInventoryStatus[])
        : undefined,
    };
    const list = await this.inventoryRepo.list(filter);
    return list.map(toMarketplaceInventoryItemDTO);
  }
}
