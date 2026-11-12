import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard, platformSettings, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ExpenseCounterpartiesService } from '../services/expense-counterparties.service';
import {
  ArchiveExpenseCounterpartyInputDTO,
  CheckExpenseCounterpartyInputDTO,
  ExpenseCounterpartyRequisiteIssueDTO,
  ExpenseCounterpartyDTO,
  ExpenseCounterpartyFormDTO,
  ExpenseCounterpartyIdInputDTO,
  ListExpenseCounterpartiesInputDTO,
  SaveExpenseCounterpartyInputDTO,
  UpdateExpenseCounterpartyInputDTO,
  toExpenseCounterpartyDTO,
  toExpenseCounterpartyFormDTO,
  toExpenseCounterpartyInput,
} from '../dto/expense-counterparty.dto';

/**
 * Реестр контрагентов шасси расходов (задача 99D-35): организации и ИП, которым
 * кооператив платит по реквизитам. Видят совет и операторы участков; контрагентов
 * кооператива ведёт совет, контрагентов участка — совет и операторы участка.
 * Кто именно вправе — сверяет сервис по участку контрагента.
 */
@Resolver()
@Injectable()
export class ExpenseCounterpartiesResolver {
  constructor(private readonly counterparties: ExpenseCounterpartiesService) {}

  @Query(() => ExpenseCounterpartyFormDTO, {
    name: 'expenseCounterpartyForm',
    description: 'Форма контрагента по стране кооператива: реквизиты, обязательность и длины значений.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'read')
  async expenseCounterpartyForm(): Promise<ExpenseCounterpartyFormDTO> {
    return toExpenseCounterpartyFormDTO(await this.counterparties.form(platformSettings().coopname));
  }

  @Query(() => [ExpenseCounterpartyRequisiteIssueDTO], {
    name: 'checkExpenseCounterpartyRequisites',
    description: 'Проверка реквизитов контрагента до сохранения: какие поля пусты, неверного вида или не проходят контрольную сумму.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'read')
  async checkExpenseCounterpartyRequisites(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: CheckExpenseCounterpartyInputDTO
  ): Promise<ExpenseCounterpartyRequisiteIssueDTO[]> {
    const requisites = Object.fromEntries(data.requisites.map((r) => [r.key, r.value]));
    return this.counterparties.check(platformSettings().coopname, currentUser, data.kind, requisites);
  }

  @Query(() => [ExpenseCounterpartyDTO], {
    name: 'expenseCounterparties',
    description: 'Контрагенты кооператива с поиском по наименованию и налоговому номеру. Видят совет и операторы кооперативных участков.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'read')
  async expenseCounterparties(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data', { nullable: true }) data?: ListExpenseCounterpartiesInputDTO
  ): Promise<ExpenseCounterpartyDTO[]> {
    const list = await this.counterparties.list(platformSettings().coopname, currentUser, {
      search: data?.search ?? null,
      include_archived: data?.include_archived ?? false,
    });
    return list.map(toExpenseCounterpartyDTO);
  }

  @Mutation(() => ExpenseCounterpartyDTO, {
    name: 'createExpenseCounterparty',
    description:
      'Добавить контрагента. Контрагента кооператива добавляет совет; председатель участка и его доверенные лица добавляют контрагента с пометкой своего участка.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'manage')
  async createExpenseCounterparty(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: SaveExpenseCounterpartyInputDTO
  ): Promise<ExpenseCounterpartyDTO> {
    const view = await this.counterparties.create(platformSettings().coopname, currentUser, toExpenseCounterpartyInput(data));
    return toExpenseCounterpartyDTO(view);
  }

  @Mutation(() => ExpenseCounterpartyDTO, {
    name: 'updateExpenseCounterparty',
    description: 'Изменить наименование, реквизиты или назначение платежа контрагента. Поданные записки сохраняют прежние реквизиты.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'manage')
  async updateExpenseCounterparty(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: UpdateExpenseCounterpartyInputDTO
  ): Promise<ExpenseCounterpartyDTO> {
    const view = await this.counterparties.update(platformSettings().coopname, currentUser, data.id, toExpenseCounterpartyInput(data));
    return toExpenseCounterpartyDTO(view);
  }

  @Mutation(() => ExpenseCounterpartyDTO, {
    name: 'archiveExpenseCounterparty',
    description: 'Убрать контрагента в архив или вернуть из архива. Контрагент в архиве не предлагается для новых расходов.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'manage')
  async archiveExpenseCounterparty(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: ArchiveExpenseCounterpartyInputDTO
  ): Promise<ExpenseCounterpartyDTO> {
    const view = await this.counterparties.setArchived(platformSettings().coopname, currentUser, data.id, data.archived);
    return toExpenseCounterpartyDTO(view);
  }

  @Mutation(() => Boolean, {
    name: 'deleteExpenseCounterparty',
    description: 'Удалить контрагента. Контрагента из неоплаченных плановых расходов удалить нельзя — его убирают в архив.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('ExpenseCounterparty', 'manage')
  async deleteExpenseCounterparty(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('data') data: ExpenseCounterpartyIdInputDTO
  ): Promise<boolean> {
    await this.counterparties.delete(platformSettings().coopname, currentUser, data.id);
    return true;
  }
}
