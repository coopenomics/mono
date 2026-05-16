import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceBlockOutgoingPaymentInputDTO,
  MarketplaceConfirmOutgoingPaymentInputDTO,
  MarketplaceOutgoingPaymentRequestDTO,
  MarketplaceOutgoingPaymentRequestStatusEnum,
  MarketplaceOutgoingPaymentResultDTO,
  toMarketplaceOutgoingPaymentRequestDTO,
} from '../dto/marketplace-outgoing-payment.dto';
import {
  MARKETPLACE_OUTGOING_PAYMENT_SERVICE,
  MarketplaceOutgoingPaymentService,
} from '../services/marketplace-outgoing-payment.service';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';

@Resolver()
@Injectable()
export class MarketplaceOutgoingPaymentResolver {
  constructor(
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_SERVICE)
    private readonly service: MarketplaceOutgoingPaymentService,
    @Inject(MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY)
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository
  ) {}

  @Mutation(() => MarketplaceOutgoingPaymentResultDTO, {
    name: 'marketplaceConfirmOutgoingPayment',
    description:
      'Кассир подтверждает факт банковского перевода поставщику — закрывает обязательство перед поставщиком в ledger.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceConfirmOutgoingPayment(
    @CurrentMarketplaceMember() _member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceConfirmOutgoingPaymentInputDTO
  ): Promise<MarketplaceOutgoingPaymentResultDTO> {
    const result = await this.service.confirm({
      coopname: config.coopname,
      payment_request_id: input.payment_request_id,
      payment_reference: input.payment_reference,
      bank_statement_ref: input.bank_statement_ref ?? null,
    });
    const dto = new MarketplaceOutgoingPaymentResultDTO();
    dto.payment_request = toMarketplaceOutgoingPaymentRequestDTO(result.payment_request);
    return dto;
  }

  @Mutation(() => MarketplaceOutgoingPaymentResultDTO, {
    name: 'marketplaceBlockOutgoingPayment',
    description:
      'Кассир помечает платёж заблокированным (например, отказ банка) — кооператив разбирает вручную.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceBlockOutgoingPayment(
    @CurrentMarketplaceMember() _member: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceBlockOutgoingPaymentInputDTO
  ): Promise<MarketplaceOutgoingPaymentResultDTO> {
    const result = await this.service.markBlocked({
      coopname: config.coopname,
      payment_request_id: input.payment_request_id,
      reason: input.reason,
    });
    const dto = new MarketplaceOutgoingPaymentResultDTO();
    dto.payment_request = toMarketplaceOutgoingPaymentRequestDTO(result.payment_request);
    return dto;
  }

  @Query(() => [MarketplaceOutgoingPaymentRequestDTO], {
    name: 'marketplaceListOutgoingPaymentsForCashier',
    description: 'Список запросов исходящих платежей для стола кассира.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceListOutgoingPaymentsForCashier(
    @CurrentMarketplaceMember() _member: IMarketplaceCurrentMember,
    @Args('statuses', {
      type: () => [MarketplaceOutgoingPaymentRequestStatusEnum],
      nullable: true,
    })
    statuses?: MarketplaceOutgoingPaymentRequestStatusEnum[]
  ): Promise<MarketplaceOutgoingPaymentRequestDTO[]> {
    const target =
      statuses?.length
        ? (statuses as unknown as MarketplaceOutgoingPaymentRequestStatus[])
        : ['PENDING_CASHIER_ACTION' as MarketplaceOutgoingPaymentRequestStatus];
    const list = await this.paymentRepo.listByStatus(config.coopname, target);
    return list.map(toMarketplaceOutgoingPaymentRequestDTO);
  }

  @Query(() => [MarketplaceOutgoingPaymentRequestDTO], {
    name: 'marketplaceListOutgoingPaymentsAsSupplier',
    description: 'История выплат поставщику для offerer-стола.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceListOutgoingPaymentsAsSupplier(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember
  ): Promise<MarketplaceOutgoingPaymentRequestDTO[]> {
    const list = await this.paymentRepo.listByPayee(config.coopname, member.username);
    return list.map(toMarketplaceOutgoingPaymentRequestDTO);
  }
}
