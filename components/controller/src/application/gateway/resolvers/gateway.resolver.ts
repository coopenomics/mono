import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { RolesGuard } from '@coopenomics/extension-kit';
import { AuthRoles } from '@coopenomics/extension-kit';
import { GatewayService } from '../services/gateway.service';
import { GatewayPaymentDTO } from '../dto/gateway-payment.dto';
import { SetPaymentStatusInputDTO } from '../dto/set-payment-status-input.dto';
import { PaymentFiltersInputDTO } from '../dto/payment-filters-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';

const paginatedPaymentsResult = createPaginationResult(GatewayPaymentDTO, 'PaginatedGatewayPayments');

/**
 * GraphQL резолвер для gateway
 * Обеспечивает API для управления платежами (просмотр и изменение статуса)
 */
@Resolver()
export class GatewayResolver {
  constructor(private readonly gatewayService: GatewayService) {}

  /**
   * Query: Получить список платежей с фильтрацией
   */
  @Query(() => paginatedPaymentsResult, {
    name: 'getPayments',
    description: 'Получить список платежей с возможностью фильтрации по типу, статусу и направлению.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getPayments(
    @Args('data', { nullable: true }) data: PaymentFiltersInputDTO = {},
    @Args('options', { nullable: true }) options: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<GatewayPaymentDTO>> {
    return this.gatewayService.getPayments(data, options);
  }

  /**
   * Mutation: Установить статус платежа
   */
  @Mutation(() => GatewayPaymentDTO, {
    name: 'setPaymentStatus',
    description:
      'Управление статусом платежа осущствляется мутацией setPaymentStatus. При переходе платежа в статус PAID вызывается эффект в блокчейне, который завершает операцию автоматическим переводом платежа в статус COMPLETED. При установке статуса REFUNDED запускается процесс отмены платежа в блокчейне. Остальные статусы не приводят к эффектам в блокчейне.',
  })
  @UseGuards(GqlJwtAuthGuard)
  @AuthRoles(['chairman', 'member'])
  async setPaymentStatus(
    @Args('data', { type: () => SetPaymentStatusInputDTO }) data: SetPaymentStatusInputDTO
  ): Promise<GatewayPaymentDTO> {
    return await this.gatewayService.setPaymentStatus(data);
  }
}
