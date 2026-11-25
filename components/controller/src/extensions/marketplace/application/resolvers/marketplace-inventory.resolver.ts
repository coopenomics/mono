import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  GrantedScope,
  PaginationInputDTO,
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
  MarketplaceInventoryArchivePaginationResultDTO,
  MarketplaceInventoryItemDTO,
  MarketplaceInventoryMovementDTO,
  MarketplaceInventoryMutationResultDTO,
  MarketplaceListInventoryArchiveInputDTO,
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
  type MarketplaceInventoryMovement,
} from '../../domain/repositories/marketplace-inventory.repository';
import type { MarketplaceInventoryDomainEntity } from '../../domain/entities/marketplace-inventory.entity';
import {
  MARKETPLACE_ISSUANCE_SAGA_REPOSITORY,
  type MarketplaceIssuanceSagaDomainRepository,
} from '../../domain/repositories/marketplace-issuance-saga.repository';
import { MARKETPLACE_ORDER_REPOSITORY, type MarketplaceOrderDomainRepository } from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_CONTAINER_REPOSITORY,
  type MarketplaceContainerDomainRepository,
} from '../../domain/repositories/marketplace-container.repository';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellDomainRepository,
} from '../../domain/repositories/marketplace-storage-cell.repository';
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
    private readonly orderDisplay: MarketplaceOrderDisplayService,
    @Inject(MARKETPLACE_ISSUANCE_SAGA_REPOSITORY)
    private readonly sagaRepo: MarketplaceIssuanceSagaDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_CONTAINER_REPOSITORY)
    private readonly containerRepo: MarketplaceContainerDomainRepository,
    @Inject(MARKETPLACE_STORAGE_CELL_REPOSITORY)
    private readonly cellRepo: MarketplaceStorageCellDomainRepository
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
    return this.toItemDTOs(list);
  }

  @Query(() => MarketplaceInventoryArchivePaginationResultDTO, {
    name: 'marketplaceListInventoryArchive',
    description: 'Архив склада: выданное и списанное имущество, свежее сверху, постранично.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Warehouse', 'read:own-KU', { list: 'data.braname' })
  async marketplaceListInventoryArchive(
    @GrantedScope() scope: IGrantedScope,
    @Args('data', { nullable: true }) data?: MarketplaceListInventoryArchiveInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceInventoryArchivePaginationResultDTO> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    if (scope.kus && scope.kus.length === 0) {
      return { items: [], totalCount: 0, totalPages: 0, currentPage: page };
    }
    const result = await this.inventoryRepo.listArchive(
      { coopname: platformSettings().coopname, braname: scope.kus ?? undefined },
      { limit, offset: (page - 1) * limit }
    );
    return {
      items: await this.toItemDTOs(result.items),
      totalCount: result.totalCount,
      totalPages: Math.ceil(result.totalCount / limit),
      currentPage: page,
    };
  }

  @Query(() => [MarketplaceInventoryMovementDTO], {
    name: 'marketplaceInventoryMovements',
    description: 'Журнал движения позиции склада: приёмка, размещение, маркировка, выдача, возврат, списание — кто, когда, где.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Warehouse', 'read:own-KU', { of: 'Inventory', id: 'inventory_id' })
  async marketplaceInventoryMovements(
    @Args('inventory_id', { type: () => String }) inventory_id: string
  ): Promise<MarketplaceInventoryMovementDTO[]> {
    const coopname = platformSettings().coopname;
    const movements = await this.inventoryRepo.listMovements(coopname, inventory_id);
    if (!movements.length) return [];

    const [issuedBy, places] = await Promise.all([
      this.issueActsOf(coopname, movements),
      this.placeLabelsOf(movements),
    ]);
    const accounts = new Set<string>();
    for (const m of movements) {
      const issue = this.issueOf(m, issuedBy);
      const actor = m.actor_account ?? issue?.operator;
      if (actor) accounts.add(actor);
      if (issue) accounts.add(issue.member);
    }
    const [names, branchNames] = await Promise.all([
      this.orderDisplay.resolveAccountNames([...accounts]),
      this.orderDisplay.resolveAccountNames([...new Set(movements.map((m) => m.braname).filter((b): b is string => !!b))]),
    ]);
    const nameOf = (account: string | null | undefined): string | null => (account ? names.get(account) ?? null : null);

    return movements.map((m) => {
      const issue = this.issueOf(m, issuedBy);
      const actor = m.actor_account ?? issue?.operator ?? null;
      return {
        id: m.id,
        kind: m.kind,
        at: m.at,
        actor_account: actor,
        actor_name: nameOf(actor),
        branch_name: m.braname ? branchNames.get(m.braname) ?? m.braname : null,
        place_label: places(m),
        quantity: m.quantity,
        barcode_value: m.barcode_value,
        order_id: m.order_id,
        recipient_account: issue?.member ?? null,
        recipient_name: nameOf(issue?.member),
      };
    });
  }

  /** Акт выдачи шага «выдано»: кто выдал и кому; у прочих шагов акта нет. */
  private issueOf(
    m: MarketplaceInventoryMovement,
    issuedBy: Map<string, { operator: string; member: string }>
  ): { operator: string; member: string } | undefined {
    return m.kind === 'ISSUED' && m.order_id ? issuedBy.get(m.order_id) : undefined;
  }

  /** Выдача: кто выдал и кому — из акта выдачи по заказу, один акт на заказ. */
  private async issueActsOf(
    coopname: string,
    movements: MarketplaceInventoryMovement[]
  ): Promise<Map<string, { operator: string; member: string }>> {
    const issuedBy = new Map<string, { operator: string; member: string }>();
    for (const m of movements) {
      const orderId = m.kind === 'ISSUED' ? m.order_id : null;
      if (!orderId || issuedBy.has(orderId)) continue;
      const order = await this.orderRepo.findById(orderId);
      const saga = order?.order_hash ? await this.sagaRepo.findByOrderHash(coopname, order.order_hash) : null;
      if (saga) issuedBy.set(orderId, { operator: saga.operator_account, member: saga.member_account });
    }
    return issuedBy;
  }

  /**
   * Подпись места шага: коды бокса и ячейки. Шагов у позиции единицы,
   * справочник читается по ключу.
   */
  private async placeLabelsOf(
    movements: MarketplaceInventoryMovement[]
  ): Promise<(m: MarketplaceInventoryMovement) => string | null> {
    const containerCodes = new Map<string, string>();
    const cellCodes = new Map<string, string>();
    for (const m of movements) {
      if (m.container_id && !containerCodes.has(m.container_id)) {
        containerCodes.set(m.container_id, (await this.containerRepo.findById(m.container_id))?.code ?? '');
      }
      if (m.cell_id && !cellCodes.has(m.cell_id)) {
        cellCodes.set(m.cell_id, (await this.cellRepo.findById(m.cell_id))?.code ?? '');
      }
    }
    return (m) => {
      const parts = [m.container_id ? containerCodes.get(m.container_id) : '', m.cell_id ? cellCodes.get(m.cell_id) : ''];
      return parts.filter(Boolean).join(' · ') || null;
    };
  }

  /** Позиции склада с полями показа: ФИО заказчика, единица, пункт выдачи, предложение. */
  private async toItemDTOs(list: MarketplaceInventoryDomainEntity[]): Promise<MarketplaceInventoryItemDTO[]> {
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
