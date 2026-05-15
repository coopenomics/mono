import { Inject, Injectable, NotFoundException, ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCancelOrderResultDTO,
  MarketplaceConsolidatedRequestActionResultDTO,
  MarketplaceCreateOrderResultDTO,
  MarketplaceOrderCreateTxSnapshotDTO,
  MarketplaceOrderDTO,
  MarketplaceOrderPaginationResultDTO,
  MarketplaceSupplierOrderActionResultDTO,
  toMarketplaceOrderDTO,
} from '../dto/marketplace-order.dto';
import { toMarketplaceConsolidatedRequestDTO } from '../dto/marketplace-consolidated-request.dto';
import {
  MarketplaceAcceptConsolidatedRequestInputDTO,
  MarketplaceAcceptIndividualOrderInputDTO,
  MarketplaceCancelOrderInputDTO,
  MarketplaceCreateOrderInputDTO,
  MarketplaceDeclineConsolidatedRequestInputDTO,
  MarketplaceDeclineIndividualOrderInputDTO,
  MarketplaceDeclineOrderFromOpenPoolInputDTO,
  MarketplaceGetOrderInputDTO,
  MarketplaceListOrdersInputDTO,
} from '../dto/marketplace-order-input.dto';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
  type MarketplaceOrderListFilter,
} from '../../domain/repositories/marketplace-order.repository';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { MarketplaceOrderStatus } from '../../domain/entities/marketplace-order.types';
import {
  MARKETPLACE_ORDER_CREATE_SERVICE,
  MarketplaceOrderCreateService,
} from '../services/marketplace-order-create.service';
import {
  MARKETPLACE_ORDER_CANCEL_SERVICE,
  MarketplaceOrderCancelService,
} from '../services/marketplace-order-cancel.service';
import {
  MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE,
  MarketplaceConsolidatedRequestAcceptDeclineService,
} from '../services/marketplace-consolidated-request-accept-decline.service';
import {
  MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE,
  MarketplaceOrderSupplierActionService,
} from '../services/marketplace-order-supplier-action.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderCreateTxSnapshot } from '../../domain/entities/marketplace-order.types';

const toOrderDTO = toMarketplaceOrderDTO;

function toTxSnapshotDTO(s: MarketplaceOrderCreateTxSnapshot): MarketplaceOrderCreateTxSnapshotDTO {
  return new MarketplaceOrderCreateTxSnapshotDTO(s);
}

/**
 * Story 4.1: GraphQL Mutation `marketplaceCreateOrder`.
 *
 * Access-matrix: `Order:create` доступно marketplace-role `orderer`.
 * Если в `marketplace-role.guard` ещё не зарегистрирован Order:create —
 * декоратор сработает по существующему membership-уровню (см. Story 1.6
 * `marketplace-access-matrix.ts`). Полная регистрация permission'ов
 * Эпика 4 — отдельный access-matrix update в составе Story 4.6.
 *
 * Subscription `marketplaceOrderUpdated` появится в Story 4.6 («Мои
 * заказы»), когда фронт начнёт подписку на live-обновления статусов
 * Order'ов. На Story 4.1 только Mutation — UI после успеха показывает
 * сразу Order DTO + tx_snapshot для WalletTimeline.
 */
@Resolver()
@Injectable()
export class MarketplaceOrderResolver {
  constructor(
    @Inject(MARKETPLACE_ORDER_CREATE_SERVICE)
    private readonly createService: MarketplaceOrderCreateService,
    @Inject(MARKETPLACE_ORDER_CANCEL_SERVICE)
    private readonly cancelService: MarketplaceOrderCancelService,
    @Inject(MARKETPLACE_CONSOLIDATED_REQUEST_ACCEPT_DECLINE_SERVICE)
    private readonly consolidatedAcceptDeclineService: MarketplaceConsolidatedRequestAcceptDeclineService,
    @Inject(MARKETPLACE_ORDER_SUPPLIER_ACTION_SERVICE)
    private readonly supplierActionService: MarketplaceOrderSupplierActionService,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository
  ) {}

  @Mutation(() => MarketplaceCreateOrderResultDTO, {
    name: 'marketplaceCreateOrder',
    description:
      'Story 4.1: заказчик создаёт Order; backend submit createorder через ledger2 (атомарная серия o.wal.conv → o.mkt.assign → o.mkt.block).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'create')
  async marketplaceCreateOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceCreateOrderInputDTO
  ): Promise<MarketplaceCreateOrderResultDTO> {
    const result = await this.createService.execute({
      coopname: config.coopname,
      orderer_account: member.username,
      offer_id: input.offer_id,
      quantity: input.quantity,
      delivery_braname: input.delivery_braname,
    });
    return new MarketplaceCreateOrderResultDTO({
      order: toOrderDTO(result.order),
      tx_snapshot: toTxSnapshotDTO(result.tx_snapshot),
    });
  }

  @Mutation(() => MarketplaceCancelOrderResultDTO, {
    name: 'marketplaceCancelOrder',
    description:
      'Story 4.4: заказчик отменяет Order до акцепта поставщиком. Backend submit cancelorder (o.mkt.unblk на total_cost) + Order.status: ACTIVE → CANCELLED_BY_ORDERER.',
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

  @Mutation(() => MarketplaceConsolidatedRequestActionResultDTO, {
    name: 'marketplaceAcceptConsolidatedRequest',
    description:
      'Story 4.5: поставщик акцептует консолидированную заявку (time_based / volume_based). Per-Order on-chain acceptorder; consolidated_request → ACCEPTED, Order\'ы → ACCEPTED.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceAcceptConsolidatedRequest(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAcceptConsolidatedRequestInputDTO
  ): Promise<MarketplaceConsolidatedRequestActionResultDTO> {
    const result = await this.consolidatedAcceptDeclineService.accept({
      coopname: config.coopname,
      offerer_account: member.username,
      request_id: input.request_id,
    });
    return new MarketplaceConsolidatedRequestActionResultDTO({
      request: toMarketplaceConsolidatedRequestDTO(result.request),
      affected_orders: result.affected_orders,
      on_chain_succeeded: result.on_chain_succeeded,
      on_chain_failed: result.on_chain_failed,
    });
  }

  @Mutation(() => MarketplaceConsolidatedRequestActionResultDTO, {
    name: 'marketplaceDeclineConsolidatedRequest',
    description:
      'Story 4.5: поставщик отказывается от консолидированной заявки. Per-Order on-chain declineorder (o.mkt.unblk + статус); consolidated_request → DECLINED_BY_SUPPLIER, Order\'ы → CANCELLED_BY_SUPPLIER.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceDeclineConsolidatedRequest(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceDeclineConsolidatedRequestInputDTO
  ): Promise<MarketplaceConsolidatedRequestActionResultDTO> {
    const result = await this.consolidatedAcceptDeclineService.decline({
      coopname: config.coopname,
      offerer_account: member.username,
      request_id: input.request_id,
      reason: input.reason,
    });
    return new MarketplaceConsolidatedRequestActionResultDTO({
      request: toMarketplaceConsolidatedRequestDTO(result.request),
      affected_orders: result.affected_orders,
      on_chain_succeeded: result.on_chain_succeeded,
      on_chain_failed: result.on_chain_failed,
    });
  }

  @Mutation(() => MarketplaceSupplierOrderActionResultDTO, {
    name: 'marketplaceAcceptIndividualOrder',
    description:
      'Story 4.5: поставщик акцептует один Order (cycle_type=individual) → on-chain acceptorder, Order.status: ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL → ACCEPTED.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceAcceptIndividualOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAcceptIndividualOrderInputDTO
  ): Promise<MarketplaceSupplierOrderActionResultDTO> {
    const result = await this.supplierActionService.acceptIndividual({
      coopname: config.coopname,
      offerer_account: member.username,
      order_id: input.order_id,
    });
    return new MarketplaceSupplierOrderActionResultDTO({
      order: toOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Mutation(() => MarketplaceSupplierOrderActionResultDTO, {
    name: 'marketplaceDeclineIndividualOrder',
    description:
      'Story 4.5: поставщик отказывается от одного Order\'а (cycle_type=individual) → on-chain declineorder (o.mkt.unblk + статус), Order.status → CANCELLED_BY_SUPPLIER.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceDeclineIndividualOrder(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceDeclineIndividualOrderInputDTO
  ): Promise<MarketplaceSupplierOrderActionResultDTO> {
    const result = await this.supplierActionService.declineIndividual({
      coopname: config.coopname,
      offerer_account: member.username,
      order_id: input.order_id,
      reason: input.reason,
    });
    return new MarketplaceSupplierOrderActionResultDTO({
      order: toOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Mutation(() => MarketplaceSupplierOrderActionResultDTO, {
    name: 'marketplaceDeclineOrderFromOpenPool',
    description:
      'Story 4.5: поставщик отказывается от одного Order\'а из open_subscription пула до запуска поставки (ACTIVE + cycle_id=null) → on-chain declineorder, Order.status → CANCELLED_BY_SUPPLIER. После triggerOpenSubscription частичный отказ недоступен.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Offer', 'update:own')
  async marketplaceDeclineOrderFromOpenPool(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceDeclineOrderFromOpenPoolInputDTO
  ): Promise<MarketplaceSupplierOrderActionResultDTO> {
    const result = await this.supplierActionService.declineFromOpenPool({
      coopname: config.coopname,
      offerer_account: member.username,
      order_id: input.order_id,
      reason: input.reason,
    });
    return new MarketplaceSupplierOrderActionResultDTO({
      order: toOrderDTO(result.order),
      tx_hash: result.tx_hash,
    });
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListMyOrders',
    description:
      'Story 4.6: orderer-стол «Мои заказы» — Order\'ы, где orderer_account == current member. ACL Order:read:own (фильтрация по owner делается в resolver).',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:own')
  async marketplaceListMyOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      orderer_account: member.username,
      supplier_account: input?.supplier_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    return this.runListQuery(filter, input);
  }

  @Query(() => MarketplaceOrderPaginationResultDTO, {
    name: 'marketplaceListSupplierOrders',
    description:
      'Story 4.6: offerer-стол — Order\'ы, где supplier_account == current member. ACL Order:read:to-self.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Order', 'read:to-self')
  async marketplaceListSupplierOrders(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('input', { nullable: true }) input?: MarketplaceListOrdersInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const filter: MarketplaceOrderListFilter = {
      coopname: config.coopname,
      supplier_account: member.username,
      orderer_account: input?.orderer_account,
      offer_id: input?.offer_id,
      status: input?.statuses?.length ? (input.statuses as MarketplaceOrderStatus[]) : undefined,
    };
    return this.runListQuery(filter, input);
  }

  @Query(() => MarketplaceOrderDTO, {
    name: 'marketplaceGetOrder',
    description:
      'Story 4.6: один Order по id. ACL: orderer (read:own) / offerer (read:to-self) / admin+board (read:all). Ownership-check в резолвере.',
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
    if (!canReadOwn && !canReadToSelf && !canReadAll) {
      throw new ForbiddenException('Нет прав на просмотр заказа.');
    }
    return toOrderDTO(order);
  }

  private async runListQuery(
    filter: MarketplaceOrderListFilter,
    input?: MarketplaceListOrdersInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const result = await this.orderRepo.list(filter, {
      page: input?.page ?? 1,
      limit: input?.limit ?? 50,
      sortBy: input?.sortBy ?? 'updated_at',
      sortOrder: (input?.sortOrder ?? 'DESC') as 'ASC' | 'DESC',
    });
    return {
      items: result.items.map(toOrderDTO),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }
}
