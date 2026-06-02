import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Cooperative } from 'cooptypes';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { TransactionDTO } from '~/application/common/dto/transaction-result-response.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerateDocumentInputDTO } from '~/application/document/dto/generate-document-input.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
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
 *   • L2-допуски и обновление ставки (Эпик D): request/approve/decline/invite/accept/decline-invite/request-rate-update;
 *   • генерация документов для L2-допусков (registry 1100/1101/1102).
 *
 * Расходы программы (Эпик B) вынесены в отдельный `ProgramExpensesManagementResolver`.
 */
@Resolver()
export class BlagorostAdditionsResolver {
  constructor(
    @Inject(CAPITAL_BLOCKCHAIN_PORT)
    private readonly chain: CapitalBlockchainPort,
    private readonly documentInteractor: DocumentInteractor,
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

  // ─── L2-допуски ────────────────────────────────────────────────────────

  @Mutation(() => TransactionDTO, {
    name: 'capitalRequestRole',
    description: 'Заявление пайщика на L2-допуск (creator/author/coordinator)',
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

  // ─── Генерация документов для L2/обновления ставки ────────────────────

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateRoleRequestStatement',
    description: 'Сгенерировать заявление о L2-допуске (registry 1100)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  async generateRoleRequestStatement(
    @Args('data') data: GenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return (await this.documentInteractor.generateDocument({
      data: { ...data, registry_id: Cooperative.Registry.RoleRequestStatement.registry_id },
      options,
    })) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateRoleInviteStatement',
    description: 'Сгенерировать приглашение мастера на L2-допуск (registry 1101)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  async generateRoleInviteStatement(
    @Args('data') data: GenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return (await this.documentInteractor.generateDocument({
      data: { ...data, registry_id: Cooperative.Registry.RoleInviteStatement.registry_id },
      options,
    })) as GeneratedDocumentDTO;
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'capitalGenerateRateUpdateStatement',
    description: 'Сгенерировать заявление об обновлении ставки часа (registry 1102)',
  })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['user'])
  async generateRateUpdateStatement(
    @Args('data') data: GenerateDocumentInputDTO,
    @Args('options', { nullable: true }) options: GenerateDocumentOptionsInputDTO,
  ): Promise<GeneratedDocumentDTO> {
    return (await this.documentInteractor.generateDocument({
      data: { ...data, registry_id: Cooperative.Registry.RateUpdateStatement.registry_id },
      options,
    })) as GeneratedDocumentDTO;
  }
}
