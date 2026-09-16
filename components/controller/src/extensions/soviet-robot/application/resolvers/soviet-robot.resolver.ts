import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AuthRoles,
  CurrentUser,
  GqlJwtAuthGuard,
  PaginationInputDTO,
  RolesGuard,
  createPaginationResult,
  platformSettings,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort, type IMonoAccount } from '@coopenomics/innercoop';
import { RobotCouncilDTO, RobotDecisionTypeDTO } from '../dto/robot-registry.dto';
import { RobotDecisionDTO } from '../dto/robot-journal.dto';
import { RobotDelegateKeyInputDTO, RobotKeyStatusDTO, RobotRetryDecisionInputDTO } from '../dto/robot-key.dto';
import { RobotRegistryService, requiredVotes } from '../services/robot-registry.service';
import { RobotKeyService } from '../services/robot-key.service';
import { RobotWatchdogService } from '../services/robot-watchdog.service';
import { RobotChainService } from '../services/robot-chain.service';
import { ROBOT_DECISION_REPOSITORY, type RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';

const paginatedRobotDecisions = createPaginationResult(RobotDecisionDTO, 'PaginatedRobotDecisions');

/**
 * Стол «Робот совета». Все операции — только для членов совета; управление
 * состоянием робота и ручной повтор — для председателя.
 */
@Resolver()
export class SovietRobotResolver {
  private readonly coopname = platformSettings().coopname;

  constructor(
    private readonly registry: RobotRegistryService,
    private readonly keys: RobotKeyService,
    private readonly watchdog: RobotWatchdogService,
    private readonly chain: RobotChainService,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    @Inject(ROBOT_DECISION_REPOSITORY) private readonly journal: RobotDecisionRepository
  ) {}

  @Query(() => [RobotDecisionTypeDTO], {
    name: 'sovietRobotRegistry',
    description: 'Реестр действий автоматизации: кто и что делегировал роботу по каждому типу решения и достигнут ли кворум робота',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getRegistry(@CurrentUser() user: IMonoAccount): Promise<RobotDecisionTypeDTO[]> {
    return this.registry.getRegistry(this.coopname, user.username);
  }

  @Query(() => RobotCouncilDTO, {
    name: 'sovietRobotCouncil',
    description: 'Совет кооператива: идентификатор, председатель, состав и порог голосов',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getCouncil(): Promise<RobotCouncilDTO> {
    const board = await this.chain.getSovietBoard(this.coopname);
    if (!board) throw new Error('Совет кооператива не найден');
    // Имя для показа берём у ядра: служебное учётное имя в интерфейсе не показываем.
    const members = await Promise.all(
      board.members.map(async (m) => ({
        username: String(m.username),
        full_name: await this.displayName(String(m.username)),
        is_voting: !!m.is_voting,
        position: String(m.position),
        position_title: String(m.position_title ?? ''),
      }))
    );
    return {
      board_id: Number(board.id),
      chairman: members.find((m) => m.position === 'chairman')?.username ?? null,
      required_votes: requiredVotes(members.length),
      members,
    };
  }

  /** ФИО пайщика; если учётной записи нет, показываем то, что знает цепь. */
  private async displayName(username: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(username)) || username;
    } catch {
      return username;
    }
  }

  @Query(() => RobotKeyStatusDTO, {
    name: 'sovietRobotKeyStatus',
    description: 'Состояние ключа робота текущего члена совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getKeyStatus(@CurrentUser() user: IMonoAccount): Promise<RobotKeyStatusDTO> {
    return this.keys.getStatus(this.coopname, user.username);
  }

  @Query(() => [RobotKeyStatusDTO], {
    name: 'sovietRobotKeys',
    description: 'Состояние ключей робота у всех членов совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getKeys(): Promise<RobotKeyStatusDTO[]> {
    const board = await this.chain.getSovietBoard(this.coopname);
    const members = board?.members.map((m) => m.username) ?? [];
    return Promise.all(members.map((member) => this.keys.getStatus(this.coopname, member)));
  }

  @Query(() => paginatedRobotDecisions, {
    name: 'sovietRobotJournal',
    description: 'Журнал решений робота: этапы, голоса, транзакции и ошибки',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getJournal(@Args('options', { nullable: true }) options?: PaginationInputDTO): Promise<PaginationResult<RobotDecisionDTO>> {
    return this.journal.findPaginated(this.coopname, options);
  }

  @Mutation(() => RobotKeyStatusDTO, {
    name: 'sovietRobotDelegateKey',
    description: 'Передать роботу приватный ключ своего разрешения; ключ проверяется по цепи и хранится зашифрованным',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async delegateKey(@CurrentUser() user: IMonoAccount, @Args('data') data: RobotDelegateKeyInputDTO): Promise<RobotKeyStatusDTO> {
    return this.keys.delegateKey(this.coopname, user.username, data.wif, data.permission_name);
  }

  @Mutation(() => Boolean, {
    name: 'sovietRobotRevokeKey',
    description: 'Удалить свой ключ из хранилища робота',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async revokeKey(@CurrentUser() user: IMonoAccount): Promise<boolean> {
    return this.keys.revokeKey(this.coopname, user.username);
  }

  @Mutation(() => RobotDecisionDTO, {
    name: 'sovietRobotRetryDecision',
    description: 'Повторить обработку застрявшего решения',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async retryDecision(@Args('data') data: RobotRetryDecisionInputDTO): Promise<RobotDecisionDTO | null> {
    return this.watchdog.retry(data.decision_id);
  }
}
