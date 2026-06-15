import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { ExpenseProposalStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-statement-document.dto';
import { ExpenseProposalDecisionGenerateDocumentInputDTO } from '~/application/document/documents-dto/expense-proposal-decision-document.dto';
import { ExpensesMutationsService } from '../services/expenses-mutations.service';
import { ExpensesManagementService } from '../services/expenses-management.service';
import { CreateExpenseProposalInputDTO } from '../dto/create-expense-proposal.input';
import { PayExpenseItemInputDTO } from '../dto/pay-expense-item.input';
import { ReportExpenseItemInputDTO } from '../dto/report-expense-item.input';
import { ExpenseReportResultDTO } from '../dto/report-expense-item.output';
import { ReturnExpenseItemInputDTO } from '../dto/return-expense-item.input';
import { OverspendExpenseItemInputDTO } from '../dto/overspend-expense-item.input';
import { SubmitExpenseReportInputDTO } from '../dto/submit-expense-report.input';

/**
 * GraphQL Mutation-резолвер контракта `expense`.
 *
 * createExpenseProposal / payExpenseItem / reportExpenseItem / returnExpenseItem /
 * overspendExpenseItem / submitExpenseReport. Все маршрутизируются в
 * `ExpensesMutationsService`, который сабмитит через `ExpensesBlockchainPort`.
 * Авторизация и отклонение СЗ — решение совета (повестка), не мутации backend'а.
 */
@Resolver()
export class ExpenseMutationsResolver {
  constructor(
    private readonly expensesMutations: ExpensesMutationsService,
    private readonly expensesManagement: ExpensesManagementService
  ) {}

  /**
   * Контракт проверяет только статус/механику строки, но не личность
   * отчитывающегося — поэтому отчёт по чужому авансу отсекается здесь:
   * пайщик может отчитаться только по своей строке, совет — по любой.
   */
  private async assertCanReportItem(
    user: MonoAccountDomainInterface,
    proposalHash: string,
    itemHash: string
  ): Promise<void> {
    if (user.role === 'chairman' || user.role === 'member') return;
    const proposal = await this.expensesManagement.getProposalByHash(proposalHash);
    const item = proposal?.items?.find(
      (i) => i.item_hash?.toLowerCase() === itemHash.toLowerCase()
    );
    if (!item || item.recipient !== user.username) {
      throw new ForbiddenException('Отчитаться по авансу может только его получатель');
    }
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateExpenseProposalStatementDocument',
    description: 'Сгенерировать документ СЗ-заявления (registry 2010) для последующей подписи.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async generateExpenseProposalStatementDocument(
    @Args('data', { type: () => ExpenseProposalStatementGenerateDocumentInputDTO })
    data: ExpenseProposalStatementGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return this.expensesMutations.generateExpenseProposalStatementDocument(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateExpenseProposalDecisionDocument',
    description: 'Сгенерировать документ-решение по СЗ (registry 2011) для последующей подписи.',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async generateExpenseProposalDecisionDocument(
    @Args('data', { type: () => ExpenseProposalDecisionGenerateDocumentInputDTO })
    data: ExpenseProposalDecisionGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return this.expensesMutations.generateExpenseProposalDecisionDocument(data, options);
  }

  @Mutation(() => TransactionDTO, {
    name: 'createExpenseProposal',
    description: 'Подать СЗ-расход (создать смету с подписью пайщика/председателя).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async createExpenseProposal(
    @Args('data', { type: () => CreateExpenseProposalInputDTO }) data: CreateExpenseProposalInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<TransactionDTO> {
    // RolesGuard пропускает запрос при data.username === user.username независимо
    // от роли — здесь это сломало бы ограничение «СЗ подаёт совет», поэтому роль
    // проверяется явно.
    if (user.role !== 'chairman' && user.role !== 'member') {
      throw new ForbiddenException('Создавать служебные записки на расход могут только председатель и члены совета');
    }
    return this.expensesMutations.createExpenseProposal(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'payExpenseItem',
    description: 'Оплатить строку расхода (выдача аванса ADVANCE или прямая оплата DIRECT).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async payExpenseItem(
    @Args('data', { type: () => PayExpenseItemInputDTO }) data: PayExpenseItemInputDTO
  ): Promise<TransactionDTO> {
    return this.expensesMutations.payExpenseItem(data);
  }

  @Mutation(() => ExpenseReportResultDTO, {
    name: 'reportExpenseItem',
    description: 'Отчитаться по строке-авансу: при совпадении факта с авансом — закрыть позицию; при недо-/перерасходе — завести платёжку расчёта разницы.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async reportExpenseItem(
    @Args('data', { type: () => ReportExpenseItemInputDTO }) data: ReportExpenseItemInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<ExpenseReportResultDTO> {
    await this.assertCanReportItem(user, data.proposal_hash, data.item_hash);
    return this.expensesMutations.reportExpenseItem(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'returnExpenseItem',
    description: 'Вернуть неиспользованный аванс по строке расхода (ADVANCE-остаток).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async returnExpenseItem(
    @Args('data', { type: () => ReturnExpenseItemInputDTO }) data: ReturnExpenseItemInputDTO
  ): Promise<TransactionDTO> {
    return this.expensesMutations.returnExpenseItem(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'overspendExpenseItem',
    description: 'Доплатить сумму перерасхода по строке расхода (ADVANCE-механика).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async overspendExpenseItem(
    @Args('data', { type: () => OverspendExpenseItemInputDTO }) data: OverspendExpenseItemInputDTO
  ): Promise<TransactionDTO> {
    return this.expensesMutations.overspendExpenseItem(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'submitExpenseReport',
    description: 'Финализировать СЗ-отчёт по смете расхода (все items закрыты — оплата/чек/возврат).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  // Закрытие расхода — финализация СЗ-отчёта советом: председатель / член совета.
  @AuthRoles(['chairman', 'member'])
  async submitExpenseReport(
    @Args('data', { type: () => SubmitExpenseReportInputDTO }) data: SubmitExpenseReportInputDTO
  ): Promise<TransactionDTO> {
    return this.expensesMutations.submitExpenseReport(data);
  }

}
