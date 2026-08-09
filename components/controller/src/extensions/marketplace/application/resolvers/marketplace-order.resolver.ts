import { Inject, Injectable, NotFoundException, ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard, PaginationInputDTO } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCancelOrderResultDTO,
  MarketplaceOrderDTO,
  MarketplaceOrderPaginationResultDTO,
  MarketplaceSupplierBatchActionResultDTO,
  toMarketplaceOrderDTO,
} from '../dto/marketplace-order.dto';
import {
  MarketplaceAcceptOrdersBatchInputDTO,
  MarketplaceCancelOrderInputDTO,
  MarketplaceDeclineOrdersBatchInputDTO,
  MarketplaceGetOrderInputDTO,
  MarketplaceListOrdersInputDTO,
} from '../dto/marketplace-order-input.dto';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
  type MarketplaceOrderListFilter,
} from '../../domain/repositories/marketplace-order.repository';
import {
  MARKETPLACE_ORDER_DISPLAY_SERVICE,
  MarketplaceOrderDisplayService,
} from '../services/marketplace-order-display.service';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_ORDER_CANCEL_SERVICE,
  MarketplaceOrderCancelService,
} from '../services/marketplace-order-cancel.service';
import {
  MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
  MarketplaceOrderSupplierActionService,
} from '../services/marketplace-order-supplier-action.service';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';

const toOrderDTO = toMarketplaceOrderDTO;

@Resolver()
@Injectable()
export class MarketplaceOrderResolver {
  constructor(
    @Inject(MARKETPLACE_ORDER_CANCEL_SERVICE)
    private readonly cancelService: MarketplaceOrderCancelService,
    @Inject(MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE)
    private readonly supplierActionService: MarketplaceOrderSupplierActionService,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(MARKETPLACE_ORDER_DISPLAY_SERVICE)
    private readonly displayService: MarketplaceOrderDisplayService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Mutation(() => MarketplaceCancelOrderResultDTO, {
    name: 'marketplaceCancelOrder',
    description: 'Отменить свой заказ до его приёма поставщиком; средства разблокируются.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'cancel:own')
  async marketplaceCancelOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceCancelOrderInputDTO
  ): Promise<MarketplaceCancelOrderResultDTO> {
    const result = await this.cancelService.execute({
      coopname: config.coopname,
      orderer_account: member.username,
      order_id: input.order_id,
    });
    return new MarketplaceCancelOrderResultDTO({
      order: toOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Mutation(() => MarketplaceSupplierBatchActionResultDTO, {
    name: 'marketplaceAcceptOrdersBatch',
    description:
      'Поставщик принимает к поставке выбранные заказы (любое подмножество группы offer × КУ) — единым массивом.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceAcceptOrdersBatch(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAcceptOrdersBatchInputDTO
  ): Promise<MarketplaceSupplierBatchActionResultDTO> {
    const result = await this.supplierActionService.acceptOrdersBatch({
      coopname: config.coopname,
      offerer_account: member.username,
      order_ids: input.order_ids,
    });
    return new MarketplaceSupplierBatchActionResultDTO({
      cycle_id: result.cycle_id,
      orders: result.orders.map((o) => toOrderDTO(o)),
      tx_hashes: result.tx_hashes,
    });
  }

  @Mutation(() => MarketplaceSupplierBatchActionResultDTO, {
    name: 'marketplaceDeclineOrdersBatch',
    description: 'Поставщик отказывается от выбранных активных заказов; средства пайщиков разблокируются.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceDeclineOrdersBatch(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceDeclineOrdersBatchInputDTO
  ): Promise<MarketplaceSupplierBatchActionResultDTO> {
    const result = await this.supplierActionService.declineOrdersBatch({
      coopname: config.coopname,
      offerer_account: member.username,
      order_ids: input.order_ids,
      reason: input.reason,
    });
    return new MarketplaceSupplierBatchActionResultDTO({
      cycle_id: result.cycle_id,
      orders: result.orders.map((o) => toOrderDTO(o)),
      tx_hashes: result.tx_hashes,
    });
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListMyOrders',
    description: 'Список заказов текущего пайщика (стол заказчика).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:own')
  async marketplaceListMyOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      orderer_account: member.username,
      supplier_account: input?.supplier_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    // Стол заказчика: показываем наименование поставщика/ПВЗ и прогресс сбора
    // коллективного заказа (сколько накоплено по оферте × КУ всеми пайщиками).
    return this.runListQuery(filter, options, {
      withParticipantNames: true,
      withGroupProgress: true,
    });
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListSupplierOrders',
    description: 'Список заказов, по которым текущий пайщик является поставщиком (стол поставщика).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:to-self')
  async marketplaceListSupplierOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      supplier_account: member.username,
      orderer_account: input?.orderer_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    // Стол поставщика: показываем «кто заказал» (ФИО/наименование заказчика).
    return this.runListQuery(filter, options, { withParticipantNames: true });
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListAllOrders',
    description: 'Реестр всех заказов кооператива с их текущими статусами (стол администратора).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:all')
  async marketplaceListAllOrders(
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      orderer_account: input?.orderer_account,
      supplier_account: input?.supplier_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    // Стол администратора видит обе стороны сделки: и ФИО заказчика, и
    // наименование поставщика — поэтому обогащаем именами участников.
    return this.runListQuery(filter, options, { withParticipantNames: true });
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListBranchOrders',
    description:
      'Реестр заказов, идущих на конкретный кооперативный участок, с их текущими статусами (стол ПВЗ).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:own-KU')
  async marketplaceListBranchOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('braname') braname: string,
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    await this.assertBranchScope(member, braname);
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      delivery_braname: braname,
      orderer_account: input?.orderer_account,
      supplier_account: input?.supplier_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    // Стол ПВЗ видит обе стороны сделки на своём участке — как и администратор.
    return this.runListQuery(filter, options, { withParticipantNames: true });
  }

  @Query(() => MarketplaceOrderDTO, {
    name: 'marketplaceGetOrder',
    description: 'Получить один заказ по его идентификатору (доступ зависит от роли).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceGetOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceGetOrderInputDTO
  ): Promise<MarketplaceOrderDTO> {
    const order = await this.orderRepo.findById(input.order_id);
    if (!order || order.coopname !== config.coopname) {
      throw new NotFoundException('Заказ не найден.');
    }
    const roles = member.marketplace_roles as MarketplaceRole[];
    const isOwner = order.orderer_account === member.username;
    const isToSelf = order.supplier_account === member.username;
    const canReadOwn = isOwner && canAccess(roles, 'Order', 'read:own');
    const canReadToSelf = isToSelf && canAccess(roles, 'Order', 'read:to-self');
    const canReadAll = canAccess(roles, 'Order', 'read:all');
    // Стол ПВЗ: председатель и доверенные участка открывают карточку любого
    // заказа, идущего на их участок — тот же скоуп, что и у реестра заказов
    // участка (marketplaceListBranchOrders).
    const canReadOwnKU =
      !canReadAll &&
      canAccess(roles, 'Order', 'read:own-KU') &&
      (await this.kuChairmanService.isMemberOfBranch(
        config.coopname,
        order.delivery_braname,
        member.username
      ));
    if (!canReadOwn && !canReadToSelf && !canReadAll && !canReadOwnKU) {
      throw new ForbiddenException('Нет прав на просмотр заказа.');
    }
    // Обе стороны сделки видны только тем, кто смотрит заказ «сверху» —
    // администратору кооператива и участку получения.
    const display = await this.displayService.enrichOne(order, {
      withParticipantNames: canReadAll || canReadOwnKU,
    });
    return toOrderDTO(order, display);
  }

  /** Own-KU скоуп: председатель/доверенный видит реестр только своего КУ; админ (read:all) — любой. */
  private async assertBranchScope(member: IMarketplaceCurrentMember, braname: string): Promise<void> {
    if (canAccess(member.marketplace_roles as MarketplaceRole[], 'Order', 'read:all')) return;
    await this.kuChairmanService.assertIsMemberOfBranch(
      config.coopname,
      braname,
      member.username,
      'Реестр заказов участка доступен его председателю и доверенным'
    );
  }

  private async runListQuery(
    filter: MarketplaceOrderListFilter,
    options?: PaginationInputDTO,
    enrichOpts?: { withParticipantNames?: boolean; withGroupProgress?: boolean }
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const result = await this.orderRepo.list(filter, {
      page: options?.page ?? 1,
      limit: options?.limit ?? 50,
      sortBy: options?.sortBy ?? 'updated_at',
      sortOrder: options?.sortOrder ?? 'DESC',
    });
    const displayByOrderId = await this.displayService.enrich(result.items, enrichOpts);
    const dto = new MarketplaceOrderPaginationResultDTO();
    dto.items = result.items.map((o) => toOrderDTO(o, displayByOrderId.get(o.id)));
    dto.totalCount = result.totalCount;
    dto.totalPages = result.totalPages;
    dto.currentPage = result.currentPage;
    return dto;
  }
}
