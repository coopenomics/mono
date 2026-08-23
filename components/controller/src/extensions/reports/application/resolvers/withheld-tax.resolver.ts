import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles, GqlJwtAuthGuard, RolesGuard, platformSettings } from '@coopenomics/extension-kit';
import {
  PayWithheldTaxInputDTO,
  WithheldTaxPaymentPageDTO,
  WithheldTaxStateDTO,
} from '../dto/withheld-tax.dto';
import { WithheldTaxService } from '../services/withheld-tax.service';

/** Сколько заявок показывать за раз, если страница не задана. */
const DEFAULT_PAGE_SIZE = 20;

/**
 * Перечисление удержанного налога — раздел стола бухгалтера.
 *
 * Кооператив выступает налоговым агентом: удержал налог при выплате дохода —
 * обязан перечислить его в бюджет. Решения совета для этого не нужно, поэтому
 * распоряжается суммой бухгалтерия, а платит по реквизитам кассир.
 */
@Resolver()
export class WithheldTaxResolver {
  constructor(private readonly withheldTaxService: WithheldTaxService) {}

  @Query(() => WithheldTaxStateDTO, {
    name: 'getWithheldTaxState',
    description: 'Удержанный налог: сколько должны бюджету и что уже отправлено кассиру',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getWithheldTaxState(): Promise<WithheldTaxStateDTO> {
    return this.withheldTaxService.getState(platformSettings().coopname);
  }

  @Query(() => WithheldTaxPaymentPageDTO, {
    name: 'getWithheldTaxPayments',
    description: 'История перечислений удержанного налога — от новых к старым',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getWithheldTaxPayments(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number
  ): Promise<WithheldTaxPaymentPageDTO> {
    return this.withheldTaxService.listPayments(
      platformSettings().coopname,
      page ?? 1,
      limit ?? DEFAULT_PAGE_SIZE
    );
  }

  @Mutation(() => String, {
    name: 'payWithheldTax',
    description:
      'Отправить удержанный налог на оплату кассиру. Возвращает отправленную сумму',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async payWithheldTax(
    @Args('data', { type: () => PayWithheldTaxInputDTO }) data: PayWithheldTaxInputDTO
  ): Promise<string> {
    return this.withheldTaxService.pay(platformSettings().coopname, data.amount);
  }
}
