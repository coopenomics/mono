import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceListOutgoingPaymentsAsSupplierFilterInputDTO,
  MarketplaceListOutgoingPaymentsFilterInputDTO,
  MarketplaceOutgoingPaymentRequestDTO,
  toMarketplaceOutgoingPaymentRequestDTO,
} from '../dto/marketplace-outgoing-payment.dto';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';

/**
 * Story 5.6 / 5.7 + 598-16 (L12): резолвер истории выплат поставщику
 * на стороне marketplace. Подтверждение и отказ выплат выполняет общий
 * стол кассира кооператива (через расширение gateway). Здесь —
 * только read-only лента для marketplace-стола поставщика, чтобы он
 * видел статус каждого выплат в одном UI с заказами.
 */
@Resolver()
@Injectable()
export class MarketplaceOutgoingPaymentResolver {
  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository
  ) {}

  @Query(() => [MarketplaceOutgoingPaymentRequestDTO], {
    name: 'marketplaceListOutgoingPaymentsAsSupplier',
    description: 'История выплат поставщику в столе поставщика — статусы по каждому заказу.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceListOutgoingPaymentsAsSupplier(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('filter', { nullable: true })
    filter?: MarketplaceListOutgoingPaymentsAsSupplierFilterInputDTO
  ): Promise<MarketplaceOutgoingPaymentRequestDTO[]> {
    const list = await this.paymentRepo.listByPayee(
      config.coopname,
      member.username,
      filter?.statuses as MarketplaceOutgoingPaymentRequestStatus[] | undefined
    );
    return list.map(toMarketplaceOutgoingPaymentRequestDTO);
  }

  @Query(() => [MarketplaceOutgoingPaymentRequestDTO], {
    name: 'marketplaceListOutgoingPayments',
    description:
      'Лента выплат поставщикам по всему кооперативу — для совета. Опциональные фильтры: по поставщику-получателю и по статусам.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Payment', 'read:all')
  async marketplaceListOutgoingPayments(
    @Args('filter', { nullable: true })
    filter?: MarketplaceListOutgoingPaymentsFilterInputDTO
  ): Promise<MarketplaceOutgoingPaymentRequestDTO[]> {
    const list = await this.paymentRepo.listAll(config.coopname, {
      payee_account: filter?.supplier_account ?? undefined,
      statuses: filter?.statuses as MarketplaceOutgoingPaymentRequestStatus[] | undefined,
    });
    return list.map(toMarketplaceOutgoingPaymentRequestDTO);
  }
}
