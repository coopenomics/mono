import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceInventoryItemDTO,
  MarketplaceLabelInventoryInputDTO,
  MarketplaceLabelInventoryResultDTO,
  MarketplaceLabelShipmentInventoryInputDTO,
  MarketplaceLabelShipmentInventoryResultDTO,
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
    private readonly inventoryRepo: MarketplaceInventoryDomainRepository,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
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

  @Mutation(() => MarketplaceLabelShipmentInventoryResultDTO, {
    name: 'marketplaceLabelShipmentInventory',
    description:
      'Массовая маркировка имущества всех заказов одной партии поставки за один вызов. Идемпотентно: уже промаркированные заказы пропускаются.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceLabelShipmentInventory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceLabelShipmentInventoryInputDTO
  ): Promise<MarketplaceLabelShipmentInventoryResultDTO> {
    const result = await this.labelService.labelShipment({
      coopname: config.coopname,
      operator_account: member.username,
      shipment_id: data.shipment_id,
      default_strategy: data.default_strategy as unknown as MarketplaceBarcodeStrategy | undefined,
      format: data.format as unknown as MarketplaceBarcodeFormat | undefined,
      per_order_overrides: data.per_order_overrides?.map((o) => ({
        order_id: o.order_id,
        strategy: o.strategy as unknown as MarketplaceBarcodeStrategy | undefined,
        pack_size: o.pack_size,
      })),
    });
    const dto = new MarketplaceLabelShipmentInventoryResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    dto.labeled_order_ids = result.labeled_order_ids;
    dto.skipped_order_ids = result.skipped_order_ids;
    return dto;
  }

  @Query(() => [MarketplaceInventoryItemDTO], {
    name: 'marketplaceListInventory',
    description: 'Список наклеек инвентаря КУ — для admin-стола склада и операторских разделов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Warehouse', 'read:own-KU')
  async marketplaceListInventory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListInventoryInputDTO
  ): Promise<MarketplaceInventoryItemDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация данных — ответственность резолвера, а не матрицы
    // (matrix отвечает только за capability). Роль с `Warehouse:read:all`
    // (admin/совет) видит склад всего кооператива; роль только с
    // `read:own-KU` (оператор/председатель КУ) ограничивается своими КУ.
    let branameFilter: string | string[] | undefined = data?.braname;
    if (!canAccess(roles, 'Warehouse', 'read:all')) {
      const ownBranames = await this.kuChairmanService.listBranamesForMember(
        coopname,
        member.username
      );
      if (ownBranames.length === 0) {
        return [];
      }
      if (data?.braname) {
        if (!ownBranames.includes(data.braname)) {
          throw new ForbiddenException(
            'Склад доступен только по участку, на котором вы являетесь председателем или доверенным лицом.'
          );
        }
        branameFilter = data.braname;
      } else {
        branameFilter = ownBranames;
      }
    }

    const filter: MarketplaceInventoryListFilter = {
      coopname,
      order_id: data?.order_id,
      shipment_id: data?.shipment_id,
      braname: branameFilter,
      status: data?.statuses?.length
        ? (data.statuses as MarketplaceInventoryStatus[])
        : undefined,
    };
    const list = await this.inventoryRepo.list(filter);
    return list.map(toMarketplaceInventoryItemDTO);
  }
}
