import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCreateOrderResultDTO,
  MarketplaceOrderCreateTxSnapshotDTO,
  MarketplaceOrderDTO,
} from '../dto/marketplace-order.dto';
import { MarketplaceCreateOrderInputDTO } from '../dto/marketplace-order-input.dto';
import {
  MARKETPLACE_ORDER_CREATE_SERVICE,
  MarketplaceOrderCreateService,
} from '../services/marketplace-order-create.service';
import type { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type { MarketplaceOrderCreateTxSnapshot } from '../../domain/entities/marketplace-order.types';

function toOrderDTO(o: MarketplaceOrderDomainEntity): MarketplaceOrderDTO {
  return new MarketplaceOrderDTO({
    id: o.id,
    coopname: o.coopname,
    order_hash: o.order_hash,
    orderer_account: o.orderer_account,
    offer_id: o.offer_id,
    offer_hash: o.offer_hash,
    supplier_account: o.supplier_account,
    delivery_braname: o.delivery_braname,
    quantity: o.quantity,
    price_per_unit: o.price_per_unit,
    total_cost: o.total_cost,
    cycle_type: o.cycle_type,
    cycle_id: o.cycle_id,
    warranty_period_secs: o.warranty_period_secs,
    warranty_until: o.warranty_until,
    status: o.status,
    last_status_reason: o.last_status_reason,
    blocked_at: o.blocked_at,
    accepted_at: o.accepted_at,
    received_at: o.received_at,
    cancelled_at: o.cancelled_at,
    create_tx: o.create_tx ? new MarketplaceOrderCreateTxSnapshotDTO(o.create_tx) : null,
    created_at: o.created_at,
    updated_at: o.updated_at,
  });
}

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
    private readonly createService: MarketplaceOrderCreateService
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
}
