import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { CAPITAL_BLOCKCHAIN_PORT, CapitalBlockchainPort } from '../../domain/interfaces/capital-blockchain.port';
import {
  AcceptInviteInputDTO,
  ApproveRoleInputDTO,
  CloseDebtInputDTO,
  DebtPayRetryInputDTO,
  DeclineInviteInputDTO,
  DeclineRoleInputDTO,
  InviteRoleInputDTO,
  MarkDebtOverdueInputDTO,
  RequestRateUpdateInputDTO,
  RequestRoleInputDTO,
} from '../dto/blagorost_additions/inputs.dto';

/**
 * Резолвер «надстройка Благорост»:
 *   • расширения по займам (Эпик A): закрытие невозврата, ретрай платежа, mark overdue;
 *   • L2-допуски и обновление ставки (Эпик D): программные actions без юридических документов.
 *
 * Расходы программы (Эпик B) вынесены в `ProgramExpensesManagementResolver`.
 */
@Resolver()
export class BlagorostAdditionsResolver {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly chain: CapitalBlockchainPort,
  ) {}

  // ─── Долги ────────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'capitalCloseDebt',
    description: 'Закрыть долг через имущество-обеспечение (проект отменён)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  closeDebt(@Args('data') data: CloseDebtInputDTO): Promise<TransactionDTO> {
    return this.chain.closeDebt(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDebtPayRetry',
    description: 'Повторить платёж по долгу после `debtpaydcln` без новой авторизации',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  debtPayRetry(@Args('data') data: DebtPayRetryInputDTO): Promise<TransactionDTO> {
    return this.chain.debtPayRetry(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalMarkDebtOverdue',
    description: 'Перевести долги с истёкшим due_at в overdue (вызывается cron-задачей)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  markDebtOverdue(@Args('data') data: MarkDebtOverdueInputDTO): Promise<TransactionDTO> {
    return this.chain.markDebtOverdue(data);
  }

  // ─── L2-допуски (программные сущности, не юридические документы) ──────

  @Mutation(() => TransactionDTO, {
    name: 'capitalRequestRole',
    description: 'Заявка пайщика на L2-допуск (creator/author/coordinator)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  requestRole(@Args('data') data: RequestRoleInputDTO): Promise<TransactionDTO> {
    return this.chain.requestRole(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalApproveRole',
    description: 'Одобрение заявки или инвайта мастером компонента',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  approveRole(@Args('data') data: ApproveRoleInputDTO): Promise<TransactionDTO> {
    return this.chain.approveRole(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDeclineRole',
    description: 'Отклонение заявки на L2-допуск мастером компонента',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  declineRole(@Args('data') data: DeclineRoleInputDTO): Promise<TransactionDTO> {
    return this.chain.declineRole(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalInviteRole',
    description: 'Приглашение мастером пайщика на L2-допуск',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  inviteRole(@Args('data') data: InviteRoleInputDTO): Promise<TransactionDTO> {
    return this.chain.inviteRole(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalAcceptInvite',
    description: 'Принять инвайт на L2-допуск',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  acceptInvite(@Args('data') data: AcceptInviteInputDTO): Promise<TransactionDTO> {
    return this.chain.acceptInvite(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalDeclineInvite',
    description: 'Отклонить инвайт на L2-допуск',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  declineInvite(@Args('data') data: DeclineInviteInputDTO): Promise<TransactionDTO> {
    return this.chain.declineInvite(data);
  }

  @Mutation(() => TransactionDTO, {
    name: 'capitalRequestRateUpdate',
    description: 'Запросить обновление утверждённой ставки часа (старая ставка действует до approve)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  requestRateUpdate(@Args('data') data: RequestRateUpdateInputDTO): Promise<TransactionDTO> {
    return this.chain.requestRateUpdate(data);
  }
}
