import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
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
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceAssignInventoryPlacementInputDTO,
  MarketplaceBindInventoryBarcodeInputDTO,
  MarketplaceClearInventoryLabelInputDTO,
  MarketplaceGenerateInventoryLabelInputDTO,
  MarketplaceInventoryItemDTO,
  MarketplaceInventoryMutationResultDTO,
  MarketplaceListInventoryInputDTO,
  MarketplaceSplitInventoryInputDTO,
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
    private readonly kuChairmanService: MarketplaceKuChairmanService,
    private readonly orderDisplay: MarketplaceOrderDisplayService
  ) {}

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceAssignInventoryPlacement',
    description:
      'Оператор КУ кладёт позицию склада в бокс либо в ячейку напрямую, или снимает её с места.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceAssignInventoryPlacement(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceAssignInventoryPlacementInputDTO
  ): Promise<MarketplaceInventoryMutationResultDTO> {
    const result = await this.labelService.assignPlacement({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_id: data.inventory_id,
      container_id: data.container_id ?? null,
      cell_id: data.cell_id ?? null,
    });
    const dto = new MarketplaceInventoryMutationResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    return dto;
  }

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceSplitInventory',
    description:
      'Оператор КУ раскладывает одну принятую позицию склада по нескольким полкам, разбивая её на отдельные записи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceSplitInventory(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceSplitInventoryInputDTO
  ): Promise<MarketplaceInventoryMutationResultDTO> {
    const result = await this.labelService.splitInventory({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_id: data.inventory_id,
      splits: data.splits.map((s) => ({
        quantity: s.quantity,
        container_id: s.container_id ?? null,
        cell_id: s.cell_id ?? null,
      })),
    });
    const dto = new MarketplaceInventoryMutationResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    return dto;
  }

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceGenerateInventoryLabel',
    description:
      'Оператор КУ наклеивает на позицию склада внутренний штрих-код (Code128 или EAN-13) для быстрого поиска на полке.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceGenerateInventoryLabel(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceGenerateInventoryLabelInputDTO
  ): Promise<MarketplaceInventoryMutationResultDTO> {
    const result = await this.labelService.generateLabel({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_id: data.inventory_id,
      format: data.format as unknown as MarketplaceBarcodeFormat | undefined,
    });
    const dto = new MarketplaceInventoryMutationResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    return dto;
  }

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceBindInventoryBarcode',
    description:
      'Оператор КУ привязывает к позиции склада штрих-код с заранее напечатанной этикетки (считанный сканером).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceBindInventoryBarcode(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceBindInventoryBarcodeInputDTO
  ): Promise<MarketplaceInventoryMutationResultDTO> {
    const result = await this.labelService.bindLabel({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_id: data.inventory_id,
      barcode_value: data.barcode_value,
      format: data.format as unknown as MarketplaceBarcodeFormat | undefined,
    });
    const dto = new MarketplaceInventoryMutationResultDTO();
    dto.inventory = result.inventory.map(toMarketplaceInventoryItemDTO);
    return dto;
  }

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceClearInventoryLabel',
    description:
      'Оператор КУ снимает штрих-код с позиции склада, чтобы переклеить этикетку (позиция возвращается в состояние «Принято»).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Inventory', 'label')
  async marketplaceClearInventoryLabel(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceClearInventoryLabelInputDTO
  ): Promise<MarketplaceInventoryMutationResultDTO> {
    const result = await this.labelService.clearLabel({
      coopname: platformSettings().coopname,
      operator_account: member.username,
      inventory_id: data.inventory_id,
    });
    const dto = new MarketplaceInventoryMutationResultDTO();
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
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListInventoryInputDTO
  ): Promise<MarketplaceInventoryItemDTO[]> {
    const coopname = platformSettings().coopname;
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
    // ФИО заказчиков, единицу измерения и реквизиты ПВЗ добираем батчем на
    // read-path (как лента заказов): по аккаунтам — имена заказчиков, по
    // заказам — наименование/адрес КУ и единица измерения из предложения.
    // Так в списке склада показываем человеческие имена, а не служебные
    // аккаунты/branames.
    const [nameByAccount, displayByOrderId] = await Promise.all([
      this.orderDisplay.resolveAccountNames(list.map((i) => i.orderer_account_snapshot)),
      this.orderDisplay.enrichByOrderIds(list.map((i) => i.order_id)),
    ]);
    return list.map((item) => {
      const dto = toMarketplaceInventoryItemDTO(item);
      dto.orderer_name = nameByAccount.get(item.orderer_account_snapshot) ?? null;
      const display = displayByOrderId.get(item.order_id);
      dto.unit_of_measure = display?.unit_of_measure ?? null;
      dto.package_size = display?.package_size ?? null;
      dto.delivery_point_name = display?.delivery_point_name ?? null;
      dto.delivery_point_address = display?.delivery_point_address ?? null;
      return dto;
    });
  }
}
