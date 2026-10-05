import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  GrantedScope,
  platformSettings,
  RequireRight,
  RightsGuard,
  type IGrantedScope,
} from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
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
    private readonly orderDisplay: MarketplaceOrderDisplayService
  ) {}

  @Mutation(() => MarketplaceInventoryMutationResultDTO, {
    name: 'marketplaceAssignInventoryPlacement',
    description:
      'Оператор КУ кладёт позицию склада в бокс либо в ячейку напрямую, или снимает её с места.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Inventory', 'label', { of: 'Inventory', id: 'data.inventory_id' })
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Inventory', 'label', { of: 'Inventory', id: 'data.inventory_id' })
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Inventory', 'label', { of: 'Inventory', id: 'data.inventory_id' })
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Inventory', 'label', { of: 'Inventory', id: 'data.inventory_id' })
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Inventory', 'label', { of: 'Inventory', id: 'data.inventory_id' })
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Warehouse', 'read:own-KU', { list: 'data.braname' })
  async marketplaceListInventory(
    @GrantedScope() scope: IGrantedScope,
    @Args('data', { nullable: true }) data?: MarketplaceListInventoryInputDTO
  ): Promise<MarketplaceInventoryItemDTO[]> {
    const coopname = platformSettings().coopname;
    // Участки отбора отдаёт гард: свои у оператора, запрошенный либо все — у
    // председателя и совета.
    if (scope.kus && scope.kus.length === 0) return [];
    const branameFilter = scope.kus ?? undefined;

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
      // Предложение и категория — из того же батча по заказам. Позиция,
      // опубликованную кооперативом остатком, ссылается на своё предложение
      // (published_offer_id), обычная — на предложение исходного заказа.
      dto.offer_id = item.published_offer_id ?? display?.offer_id ?? null;
      dto.category_id = display?.category_id ?? null;
      return dto;
    });
  }
}
