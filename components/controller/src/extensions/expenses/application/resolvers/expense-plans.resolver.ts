import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { CurrentUser } from '@coopenomics/extension-kit';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import {
  EXPENSE_PLANS_SERVICE,
  ExpensePlansService,
} from '../services/expense-plans.service';
import {
  CreateExpensePlanInputDTO,
  DeleteExpensePlanInputDTO,
  ExpensePlanDTO,
  ListExpensePlansInputDTO,
  toExpensePlanDTO,
} from '../dto/expense-plan.dto';

/**
 * Общесистемный реестр плановых расходов (requirement b6, раунд 5).
 * Планы КУ ведёт председатель участка (проверяется по on-chain составу
 * branch::branches); записи уровня кооператива откроются вместе с шасси
 * расходов. Потребители резерва (распределение членских взносов КУ) —
 * в своих расширениях через ExpensePlansService.
 */
@Resolver()
@Injectable()
export class ExpensePlansResolver {
  constructor(
    @Inject(EXPENSE_PLANS_SERVICE)
    private readonly plansService: ExpensePlansService
  ) {}

  @Query(() => [ExpensePlanDTO], {
    name: 'listExpensePlans',
    description:
      'Плановые расходы кооператива: предстоящие траты с суммой, сроком и реквизитами. Неоплаченные расходы со сроком в ближайшие 30 дней образуют резерв средств, недоступный другим использованиям.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async listExpensePlans(
    @Args('data', { nullable: true }) data?: ListExpensePlansInputDTO
  ): Promise<ExpensePlanDTO[]> {
    const plans = await this.plansService.listPlans(config.coopname, data?.braname ?? null);
    return plans.map(toExpensePlanDTO);
  }

  @Mutation(() => ExpensePlanDTO, {
    name: 'createExpensePlan',
    description:
      'Добавить плановый расход: сумма, срок, назначение и реквизиты оплаты. Для регулярной траты указывается периодичность — следующий экземпляр появляется в реестре автоматически. Планы кооперативного участка ведёт его председатель.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async createExpensePlan(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data') data: CreateExpensePlanInputDTO
  ): Promise<ExpensePlanDTO> {
    const plan = await this.plansService.createPlan(config.coopname, currentUser.username, {
      braname: data.braname ?? null,
      title: data.title,
      amount: data.amount,
      due_date: data.due_date,
      recurrence: data.recurrence ?? null,
      pay_to: data.pay_to,
    });
    return toExpensePlanDTO(plan);
  }

  @Mutation(() => Boolean, {
    name: 'deleteExpensePlan',
    description:
      'Удалить плановый расход (например, оплаченный вне системы или отменённый). Планы кооперативного участка ведёт его председатель.',
  })
  @UseGuards(GqlJwtAuthGuard)
  async deleteExpensePlan(
    @CurrentUser() currentUser: MonoAccountDomainInterface,
    @Args('data') data: DeleteExpensePlanInputDTO
  ): Promise<boolean> {
    await this.plansService.deletePlan(config.coopname, currentUser.username, data.plan_id);
    return true;
  }
}
