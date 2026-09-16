import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceOrderStatusEnum } from '../dto/marketplace-order.dto';
import {
  MarketplaceListOutgoingPaymentsAsSupplierFilterInputDTO,
  MarketplaceListOutgoingPaymentsFilterInputDTO,
  MarketplaceOutgoingPaymentCoreRecordDTO,
  MarketplaceOutgoingPaymentDetailDTO,
  MarketplaceOutgoingPaymentOrderSummaryDTO,
  MarketplaceOutgoingPaymentRequestDTO,
  toMarketplaceOutgoingPaymentRequestDTO,
} from '../dto/marketplace-outgoing-payment.dto';
import {
  MARKETPLACE_OUTGOING_PAYMENT_REQUEST_REPOSITORY,
  type MarketplaceOutgoingPaymentRequestDomainRepository,
} from '../../domain/repositories/marketplace-outgoing-payment-request.repository';
import type { MarketplaceOutgoingPaymentRequestStatus } from '../../domain/entities/marketplace-outgoing-payment-request.types';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';
import {
  MARKETPLACE_ORDER_REPOSITORY,
  type MarketplaceOrderDomainRepository,
} from '../../domain/repositories/marketplace-order.repository';
import { PAYMENT_DESK_PORT, type IPaymentDeskPort } from '@coopenomics/innercoop';

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
    private readonly paymentRepo: MarketplaceOutgoingPaymentRequestDomainRepository,
    @Inject(MARKETPLACE_ORDER_REPOSITORY)
    private readonly orderRepo: MarketplaceOrderDomainRepository,
    @Inject(PAYMENT_DESK_PORT)
    private readonly coreGateway: IPaymentDeskPort,
    private readonly displayService: MarketplaceOrderDisplayService
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
      platformSettings().coopname,
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
    const list = await this.paymentRepo.listAll(platformSettings().coopname, {
      payee_account: filter?.supplier_account ?? undefined,
      statuses: filter?.statuses as MarketplaceOutgoingPaymentRequestStatus[] | undefined,
    });
    return list.map(toMarketplaceOutgoingPaymentRequestDTO);
  }

  @Query(() => MarketplaceOutgoingPaymentDetailDTO, {
    name: 'marketplaceGetOutgoingPayment',
    nullable: true,
    description:
      'Разворот одной выплаты: сама выплата, оплаченный заказ и запись в реестре кассира. ' +
      'Null — выплаты с таким идентификатором в кооперативе нет.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Payment', 'read:all')
  async marketplaceGetOutgoingPayment(
    @Args('id', { type: () => String }) id: string
  ): Promise<MarketplaceOutgoingPaymentDetailDTO | null> {
    const coopname = platformSettings().coopname;
    const entity = await this.paymentRepo.findById(id);
    // Выплата чужого кооператива для совета не существует — не «нет доступа»,
    // а именно «нет такой записи»: чужой идентификатор не должен подтверждаться.
    if (!entity || entity.coopname !== coopname) return null;

    const detail = new MarketplaceOutgoingPaymentDetailDTO();
    detail.payment = toMarketplaceOutgoingPaymentRequestDTO(entity);
    detail.order = await this.loadOrderSummary(entity.order_id);
    detail.core_payment = await this.loadCorePayment(coopname, entity.order_hash);
    return detail;
  }

  /**
   * Предмет оплаты: заказ каталога поставок и его реквизиты. Наименование
   * товара, участок и заказчика берём тем же сервисом отображения, что и
   * ленты заказов, — чтобы разворот выплаты и реестр заказов не расходились
   * в том, как называется одна и та же поставка.
   */
  private async loadOrderSummary(
    orderId: string
  ): Promise<MarketplaceOutgoingPaymentOrderSummaryDTO | null> {
    if (!orderId) return null;
    const order = await this.orderRepo.findById(orderId);
    if (!order) return null;
    const display = await this.displayService.enrichOne(order, {
      withGroupProgress: false,
      withParticipantNames: true,
    });

    const summary = new MarketplaceOutgoingPaymentOrderSummaryDTO();
    summary.id = order.id;
    summary.product_name = display.product_name ?? null;
    summary.quantity = order.quantity;
    summary.unit_of_measure = order.unit_of_measure ?? null;
    summary.price_per_unit = order.price_per_unit;
    summary.total_cost = order.total_cost;
    summary.accepted_cost = order.accepted_cost ?? null;
    summary.status = order.status as MarketplaceOrderStatusEnum;
    summary.orderer_name = display.orderer_name ?? null;
    summary.delivery_point_name = display.delivery_point_name ?? null;
    return summary;
  }

  /**
   * Подтверждение оплаты со стороны кооператива — запись общего реестра, с
   * которой работает кассир. Ищем по `hash`: marketplace заводит платёж с
   * `payment_hash = order_hash` (см. createCorePayment), других ключей у
   * кассирского порта нет. Отказ порта не должен ронять разворот выплаты —
   * marketplace-статус самодостаточен, поэтому возвращаем null.
   */
  private async loadCorePayment(
    coopname: string,
    orderHash: string
  ): Promise<MarketplaceOutgoingPaymentCoreRecordDTO | null> {
    if (!orderHash) return null;
    try {
      const page = await this.coreGateway.getPayments(
        { coopname, hash: orderHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = page.items?.[0];
      if (!payment) return null;

      const record = new MarketplaceOutgoingPaymentCoreRecordDTO();
      record.id = payment.id ?? null;
      record.status = payment.status;
      record.quantity = payment.quantity;
      record.symbol = payment.symbol;
      record.memo = payment.memo ?? null;
      record.message = payment.message ?? null;
      record.created_at = payment.created_at;
      record.completed_at = payment.completed_at ?? null;
      return record;
    } catch {
      return null;
    }
  }
}

/**
 * Отображаемое имя получателя выплаты (`payee_name`): ФИО физлица/ИП или
 * наименование организации — живьём из аккаунта на бэкенде, тем же способом,
 * что и `supplier_name` у оферты. Лента выплат показывает человека, а не
 * системный логин аккаунта.
 */
@Resolver(() => MarketplaceOutgoingPaymentRequestDTO)
@Injectable()
export class MarketplaceOutgoingPaymentFieldsResolver {
  constructor(private readonly displayService: MarketplaceOrderDisplayService) {}

  @ResolveField('payee_name', () => String, {
    nullable: true,
    description:
      'Отображаемое имя получателя выплаты (ФИО физлица/ИП или наименование организации).',
  })
  async payeeName(
    @Parent() payment: MarketplaceOutgoingPaymentRequestDTO
  ): Promise<string | null> {
    return this.displayService.resolveAccountName(payment.payee_account);
  }
}
