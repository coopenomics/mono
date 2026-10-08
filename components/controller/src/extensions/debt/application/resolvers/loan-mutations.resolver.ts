import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  GeneratedDocumentDTO,
  GenerateDocumentOptionsInputDTO,
  GqlJwtAuthGuard,
  RequireRight,
  RightsGuard,
  TransactionDTO,
} from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { LoanMutationsService } from '../services/loan-mutations.service';
import { CreateLoanInputDTO } from '../dto/create-loan.input';
import { CancelLoanInputDTO, ExtendLoanInputDTO, LoanRefInputDTO, RepayLoanInputDTO } from '../dto/loan-action.inputs';
import {
  GenerateExtensionStatementInputDTO,
  GenerateLoanContractInputDTO,
  GenerateLoanDecisionInputDTO,
  GenerateLoanStatementInputDTO,
  GenerateRepaymentStatementInputDTO,
} from '../documents-dto/loan-documents.dto';

/**
 * Запись по займам: документы к подписи и действия цепи. Решение совета,
 * подпись председателя и выплата идут штатными механизмами совета и кассы.
 */
@Resolver()
export class LoanMutationsResolver {
  constructor(private readonly mutations: LoanMutationsService) {}

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDebtLoanStatementDocument',
    description: 'Сформировать заявление на получение беспроцентного займа для подписи пайщиком.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['generate:own', 'generate:all'], { owner: 'data.username' })
  async generateDebtLoanStatementDocument(
    @Args('data', { type: () => GenerateLoanStatementInputDTO }) data: GenerateLoanStatementInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true }) options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.mutations.generateStatement(data, options) as Promise<GeneratedDocumentDTO>;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDebtLoanContractDocument',
    description: 'Сформировать договор о беспроцентном займе под обеспечение паевым взносом для подписи пайщиком.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['generate:own', 'generate:all'], { owner: 'data.username' })
  async generateDebtLoanContractDocument(
    @Args('data', { type: () => GenerateLoanContractInputDTO }) data: GenerateLoanContractInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true }) options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.mutations.generateContract(data, options) as Promise<GeneratedDocumentDTO>;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDebtLoanDecisionDocument',
    description: 'Сформировать протокол решения совета о предоставлении беспроцентного займа.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', 'generate:all')
  async generateDebtLoanDecisionDocument(
    @Args('data', { type: () => GenerateLoanDecisionInputDTO }) data: GenerateLoanDecisionInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true }) options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.mutations.generateDecision(data, options) as Promise<GeneratedDocumentDTO>;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDebtRepaymentStatementDocument',
    description: 'Сформировать заявление о возврате беспроцентного займа для подписи пайщиком.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['generate:own', 'generate:all'], { owner: 'data.username' })
  async generateDebtRepaymentStatementDocument(
    @Args('data', { type: () => GenerateRepaymentStatementInputDTO }) data: GenerateRepaymentStatementInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true }) options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.mutations.generateRepaymentStatement(data, options) as Promise<GeneratedDocumentDTO>;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDebtExtensionStatementDocument',
    description: 'Сформировать заявление о продлении срока возврата беспроцентного займа для подписи пайщиком.',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['generate:own', 'generate:all'], { owner: 'data.username' })
  async generateDebtExtensionStatementDocument(
    @Args('data', { type: () => GenerateExtensionStatementInputDTO }) data: GenerateExtensionStatementInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true }) options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.mutations.generateExtensionStatement(data, options) as Promise<GeneratedDocumentDTO>;
  }

  @Mutation(() => TransactionDTO, {
    name: 'createDebtLoan',
    description: 'Подать заявление на беспроцентный заём под обеспечение паевым взносом: заявление и договор с подписью пайщика.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', 'create:own', { owner: 'data.username' })
  async createDebtLoan(@Args('data', { type: () => CreateLoanInputDTO }) data: CreateLoanInputDTO): Promise<TransactionDTO> {
    return this.mutations.createLoan(data) as Promise<TransactionDTO>;
  }

  @Mutation(() => TransactionDTO, {
    name: 'retryDebtLoanPayment',
    description: 'Повторно отправить платёж по займу кассиру после отказа по реквизитам.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', 'retry-pay')
  async retryDebtLoanPayment(@Args('data', { type: () => LoanRefInputDTO }) data: LoanRefInputDTO): Promise<TransactionDTO> {
    return this.mutations.retryPay(data) as Promise<TransactionDTO>;
  }

  @Mutation(() => TransactionDTO, {
    name: 'cancelDebtLoan',
    description: 'Отменить выдачу займа до выплаты: обеспечение возвращается в программу.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', ['cancel:own', 'cancel:all'], { of: 'Loan', id: 'data.debt_hash' })
  async cancelDebtLoan(
    @CurrentUser() user: IMonoAccount,
    @Args('data', { type: () => CancelLoanInputDTO }) data: CancelLoanInputDTO
  ): Promise<TransactionDTO> {
    return this.mutations.cancelLoan(data, user) as Promise<TransactionDTO>;
  }

  @Mutation(() => TransactionDTO, {
    name: 'repayDebtLoan',
    description: 'Вернуть заём с главного кошелька по заявлению пайщика, целиком или частью.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', 'repay:own', { owner: 'data.username' })
  async repayDebtLoan(
    @CurrentUser() user: IMonoAccount,
    @Args('data', { type: () => RepayLoanInputDTO }) data: RepayLoanInputDTO
  ): Promise<TransactionDTO> {
    return this.mutations.repayLoan(data, user) as Promise<TransactionDTO>;
  }

  @Mutation(() => TransactionDTO, {
    name: 'extendDebtLoan',
    description: 'Подать заявление о продлении срока возврата займа; новый срок подтверждает председатель.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Loan', 'extend:own', { owner: 'data.username' })
  async extendDebtLoan(
    @CurrentUser() user: IMonoAccount,
    @Args('data', { type: () => ExtendLoanInputDTO }) data: ExtendLoanInputDTO
  ): Promise<TransactionDTO> {
    return this.mutations.extendLoan(data, user) as Promise<TransactionDTO>;
  }
}
