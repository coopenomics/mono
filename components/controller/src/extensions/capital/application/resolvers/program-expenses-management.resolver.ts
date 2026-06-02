import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { ProgramExpensesManagementService } from '../services/program-expenses-management.service';
import {
  ApproveProgramExpenseInputDTO,
  AuthorizeProgramExpenseInputDTO,
  CreateProgramExpenseInputDTO,
  DeclineProgramExpenseInputDTO,
  PayProgramExpenseInputDTO,
  TopupProgramExpensePoolInputDTO,
} from '../dto/program_expenses_management/inputs.dto';

/**
 * GraphQL резолвер расходов программы Благорост (Эпик B).
 */
@Resolver()
export class ProgramExpensesManagementResolver {
  constructor(private readonly service: ProgramExpensesManagementService) {}

  @Mutation(() => TransactionDTO, {
    name: 'capitalCreateProgramExpense',
    description: 'Создание расхода программы (СЗ председателя/казначея)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  createProgramExpense(@Args('data') data: CreateProgramExpenseInputDTO): Promise<TransactionDTO> {
    return this.service.createProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalApproveProgramExpense',
    description: 'Одобрение расхода программы председателем',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  approveProgramExpense(@Args('data') data: ApproveProgramExpenseInputDTO): Promise<TransactionDTO> {
    return this.service.approveProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalAuthorizeProgramExpense',
    description: 'Авторизация расхода программы советом',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  authProgramExpense(@Args('data') data: AuthorizeProgramExpenseInputDTO): Promise<TransactionDTO> {
    return this.service.authProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalConfirmProgramExpensePayment',
    description: 'Подтверждение выплаты расхода программы (callback gateway)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  payProgramExpense(@Args('data') data: PayProgramExpenseInputDTO): Promise<TransactionDTO> {
    return this.service.payProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDeclineProgramExpense',
    description: 'Отклонение расхода программы (председатель/совет/кассир)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  declineProgramExpense(@Args('data') data: DeclineProgramExpenseInputDTO): Promise<TransactionDTO> {
    return this.service.declineProgramExpense(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalTopupProgramExpensePool',
    description: 'Пополнение пула расходов программы из BLAGOROST_POOL (chairman)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  topupProgramExpense(@Args('data') data: TopupProgramExpensePoolInputDTO): Promise<TransactionDTO> {
    return this.service.topupProgramExpense(data);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateProgramExpenseStatement',
    description: 'Сгенерировать заявление о расходе программы (registry 1012)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  generateProgramExpenseStatement(
    @Args('data') data: GenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return this.service.generateProgramExpenseStatement(data, options);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateProgramExpenseDecision',
    description: 'Сгенерировать решение совета о расходе программы (registry 1013)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  generateProgramExpenseDecision(
    @Args('data') data: GenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return this.service.generateProgramExpenseDecision(data, options);
  }
}
