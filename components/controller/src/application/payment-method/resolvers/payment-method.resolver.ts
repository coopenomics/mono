// payment-method.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, createPaginationResult } from '@coopenomics/extension-kit';
import { GetPaymentMethodsInputDTO } from '../dto/get-payment-methods-input.dto';
import { PaymentMethodService } from '../services/payment-method.service';
import { UpdateBankAccountInputDTO } from '../dto/update-bank-account-input.dto';
import { DeletePaymentMethodDTO } from '../dto/delete-payment-method-input.dto';
import { AddPaymentMethodInputDTO } from '../dto/add-payment-method-input.dto';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';
import { PaymentMethodDTO } from '../dto/payment-method.dto';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
const PaymentMethodPaginationResult = createPaginationResult(PaymentMethodDTO, 'PaymentMethod');

@Resolver('PaymentMethod')
export class PaymentMethodResolver {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Query(() => PaymentMethodPaginationResult, {
    name: 'getPaymentMethods',
    description: 'Получить список методов оплаты',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getPaymentMethods(
    @Args('data', { type: () => GetPaymentMethodsInputDTO, nullable: true }) data?: GetPaymentMethodsInputDTO
  ): Promise<PaginationResultDomainInterface<PaymentMethodDomainEntity>> {
    return this.paymentMethodService.listPaymentMethods(data);
  }

  @Mutation(() => PaymentMethodDTO, {
    name: 'addPaymentMethod',
    description: 'Добавить метод оплаты (банковский счёт или СБП)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async addPaymentMethod(
    @Args('data', { type: () => AddPaymentMethodInputDTO }) data: AddPaymentMethodInputDTO
  ): Promise<PaymentMethodDTO> {
    return await this.paymentMethodService.addPaymentMethod(data);
  }

  @Mutation(() => PaymentMethodDTO, { name: 'updateBankAccount', description: 'Обновить банковский счёт' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async updateBankAccount(
    @Args('data', { type: () => UpdateBankAccountInputDTO }) data: UpdateBankAccountInputDTO
  ): Promise<PaymentMethodDTO> {
    return await this.paymentMethodService.updateBankAccount(data);
  }

  @Mutation(() => Boolean, { name: 'deletePaymentMethod', description: 'Удалить метод оплаты' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async deletePaymentMethod(
    @Args('data', { type: () => DeletePaymentMethodDTO }) data: DeletePaymentMethodDTO
  ): Promise<boolean> {
    await this.paymentMethodService.deletePaymentMethod(data);
    return true;
  }
}
