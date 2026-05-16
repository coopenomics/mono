import { Inject, Injectable, NotFoundException, ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

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
    description: 'Оформить заказ по предложению и заблокировать средства пайщика.',
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

  @Mutation(() => MarketplaceConsolidatedRequestActionResultDTO, {
    name: 'marketplaceAcceptConsolidatedRequest',
    description: 'Поставщик принимает сводную заявку — все заказы в пакете переходят в принятое состояние.',
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
    description: 'Поставщик отклоняет сводную заявку — все заказы пакета отменяются, средства разблокируются.',
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
    description: 'Поставщик принимает один индивидуальный заказ.',
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
    description: 'Поставщик отказывается от одного индивидуального заказа; средства разблокируются.',
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
      'Поставщик отказывается от одного заказа из пула открытой подписки до запуска поставки (после запуска частичный отказ невозможен).',
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
    return this.runListQuery(filter, options);
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
    return this.runListQuery(filter, options);
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
    if (!canReadOwn && !canReadToSelf && !canReadAll) {
      throw new ForbiddenException('Нет прав на просмотр заказа.');
    }
    return toOrderDTO(order);
  }

  private async runListQuery(
    filter: MarketplaceOrderListFilter,
    options?: PaginationInputDTO
  ): Promise<MarketplaceOrderPaginationResultDTO> {
    const result = await this.orderRepo.list(filter, {
      page: options?.page ?? 1,
      limit: options?.limit ?? 50,
      sortBy: options?.sortBy ?? 'updated_at',
      sortOrder: options?.sortOrder ?? 'DESC',
    });
    const dto = new MarketplaceOrderPaginationResultDTO();
    dto.items = result.items.map(toOrderDTO);
    dto.totalCount = result.totalCount;
    dto.totalPages = result.totalPages;
    dto.currentPage = result.currentPage;
    return dto;
  }
}
