import { forwardRef, Module } from '@nestjs/common';
import { BaseExtModule } from '../base.extension.module';
import { CapitalDatabaseModule } from './infrastructure/database/capital-database.module';
import { RegistrationInfrastructureModule } from '~/infrastructure/registration/registration-infrastructure.module';
import { Injectable } from '@nestjs/common';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { DocumentModule } from '~/application/document/document.module';
import { DocumentInfrastructureModule } from '~/infrastructure/document/document-infrastructure.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import type { DeserializedDescriptionOfExtension } from '~/types/shared';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { Inject } from '@nestjs/common';
import { z } from 'zod';

// Функция для проверки и сериализации FieldDescription
function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

// Дефолтные параметры конфигурации
export const defaultConfig = {
  authors_voting_percent: 62.8,
  coordinator_bonus_percent: 5,
  coordinator_invite_validity_days: 30,
  creators_voting_percent: 62.8,
  expense_pool_percent: 100,
  voting_period_in_days: 1,
  energy_decay_rate_per_day: 0.02,
  level_depth_base: 100000000, // 10000 RUB с точностью 4 знака (10000 × 10^4)
  level_growth_coefficient: 1.5,
  energy_gain_coefficient: 1.0,
  // Онбординг флаги
  onboarding_generator_program_template_done: false,
  onboarding_generation_contract_template_done: false,
  onboarding_generator_offer_template_done: false,
  onboarding_blagorost_provision_done: false,
  onboarding_blagorost_offer_template_done: false,
  /** Ветка для выборки коммитов (FR3 / PRD); URL репозитория — на проекте/компоненте (PRD §6.2.1). */
  github_sync_branch: 'dev',
  /** Интервал polling GitHub API в минутах (FR2); 0 — периодический опрос отключён. */
  github_sync_poll_interval_minutes: 0,
  /** Строка в БД: либо результат `encrypt()` (тот же SERVER_SECRET, что у vault), либо plaintext при ручной настройке. */
  github_api_token_encrypted: '',
  /** Период сверки баланса Благорост с долёй в проектах и вызова regshare (минуты). 0 — фоновая задача отключена. По умолчанию 1440 мин (24 ч). */
  program_share_registration_interval_minutes: 1440,
} as const;

// Определение Zod-схемы
export const Schema = z.object({
  github_sync_branch: z
    .string()
    .min(1, 'Имя ветки не может быть пустым')
    .default(defaultConfig.github_sync_branch)
    .describe(
      describeField({
        label: 'Ветка GitHub для синхронизации',
        note: 'Ветка в указанном репозитории (по умолчанию dev). Используется при обходе истории коммитов.',
        rules: ['val.length >= 1'],
      })
    ),
  github_sync_poll_interval_minutes: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) {
        return defaultConfig.github_sync_poll_interval_minutes;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return defaultConfig.github_sync_poll_interval_minutes;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : val;
      }
      return val;
    },
    z.number().int().min(0).max(60).default(0),
  ).describe(
    describeField({
      label: 'Интервал опроса GitHub (мин)',
      note: 'Периодичность задачи синхронизации GitHub ↔ БД. 0 — опрос по расписанию отключён. Иначе: от 1 до 60 минут.',
      rules: ['val >= 0', 'val <= 60'],
      append: 'мин',
    })
  ).default(0),
  github_api_token_encrypted: z
    .string()
    .default(defaultConfig.github_api_token_encrypted)
    .describe(
      describeField({
        label: 'Токен GitHub API (read-only)',
        note: 'Токен GitHub API с доступом к репозиториям.',
        password: true,
      })
    ),
  program_share_registration_interval_minutes: z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) {
          return defaultConfig.program_share_registration_interval_minutes;
        }
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed === '') return defaultConfig.program_share_registration_interval_minutes;
          const n = Number(trimmed);
          return Number.isFinite(n) ? n : val;
        }
        return val;
      },
      z.number().int().min(0).max(525600).default(defaultConfig.program_share_registration_interval_minutes)
    )
    .describe(
      describeField({
        label: 'Интервал синхронизации баланса Благороста с проектами (мин)',
        note: 'Периодичность сверки баланса программы Благорост в кошельке участника с проектами и вызова regshare. 0 — отключено.',
        rules: ['val >= 0', 'val <= 525600'],
        append: 'мин',
      })
    )
    .default(defaultConfig.program_share_registration_interval_minutes),
  creators_voting_percent: z
    .number()
    .default(defaultConfig.creators_voting_percent)
    .describe(
      describeField({
        label: 'Пул голосования исполнителей',
        note: 'Процент от пула премий исполнителей для распределения голосованием по методу Водянова.',
        rules: ['val >= 0', 'val <= 100'],
        prepend: '%',
      })
    ),
  authors_voting_percent: z
    .number()
    .default(defaultConfig.authors_voting_percent)
    .describe(
      describeField({
        label: 'Пул голосований соавторов',
        note: 'Процент от пула премий соавторов для распределения голосованием по методу Водянова.',
        rules: ['val >= 0', 'val <= 100'],
        prepend: '%',
      })
    ),
  coordinator_bonus_percent: z
    .number()
    .default(defaultConfig.coordinator_bonus_percent)
    .describe(
      describeField({
        label: 'Премия координатора',
        note: 'Процент от суммы взноса инвестора, на который дополнительно увеличивается стоимость результата интеллектуальной деятельности. По факту внесения суммы инвестором, координатор вносит паевым взносом выполненный финансовый план и получает долю в результате.',
        rules: ['val >= 0', 'val <= 100'],
        prepend: '%',
      })
    ),
  coordinator_invite_validity_days: z
    .number()
    .default(defaultConfig.coordinator_invite_validity_days)
    .describe(
      describeField({
        label: 'Срок действия приглашения координатора',
        note: 'Продолжительность периода действия приглашений, по ходу которых координатор получает премию от взноса инвестора по его финплану. После истечения этого срока премия координатору при взносах приглашенного инвестора не начисляется.',
        rules: ['val >= 1'],
        append: 'дней',
      })
    ),
  expense_pool_percent: z
    .number()
    .default(defaultConfig.expense_pool_percent)
    .describe(
      describeField({
        label: 'Процент пула расходов',
        note: 'Процент от суммы инвестиций, который направляется в пул расходов.',
        rules: ['val >= 0', 'val <= 100'],
        prepend: '%',
      })
    ),
  voting_period_in_days: z
    .number()
    .default(defaultConfig.voting_period_in_days)
    .describe(
      describeField({
        label: 'Период голосования',
        note: 'Продолжительность периода голосования по методу Водянова в днях.',
        rules: ['val >= 1'],
        append: 'дней',
      })
    ),
  energy_decay_rate_per_day: z
    .number()
    .default(defaultConfig.energy_decay_rate_per_day)
    .describe(
      describeField({
        label: 'Скорость убывания энергии в день',
        note: 'Процент энергии, которое теряет участник ежедневно. Это мотивирует к активному участию в проектах для поддержания уровня энергии.',
        rules: ['val >= 0', 'val <= 1'],
        prepend: '%',
        append: '/день',
        visible: false,
      })
    ),
  level_depth_base: z
    .number()
    .default(defaultConfig.level_depth_base)
    .describe(
      describeField({
        label: 'Базовая глубина уровня',
        note: 'Базовое количество опыта, необходимое для достижения следующего уровня. Используется в расчете прогрессии уровней участников.',
        rules: ['val >= 1'],
        visible: false,
      })
    ),
  level_growth_coefficient: z
    .number()
    .default(defaultConfig.level_growth_coefficient)
    .describe(
      describeField({
        label: 'Коэффициент роста уровня',
        note: 'Множитель, определяющий, насколько сложнее становится достичь следующего уровня. Высокий коэффициент делает прогресс более медленным.',
        rules: ['val >= 1'],
        visible: false,
      })
    ),
  energy_gain_coefficient: z
    .number()
    .default(defaultConfig.energy_gain_coefficient)
    .describe(
      describeField({
        label: 'Коэффициент получения энергии',
        note: 'Множитель, определяющий количество энергии, получаемое за выполнение задач. Влияет на скорость восстановления энергии участников.',
        rules: ['val >= 0'],
        visible: false,
      })
    ),
  // Онбординг флаги
  onboarding_generator_program_template_done: z
    .boolean()
    .default(defaultConfig.onboarding_generator_program_template_done)
    .describe(describeField({ label: 'Шаг положения о программе ГЕНЕРАТОР выполнен', visible: false })),
  onboarding_generation_contract_template_done: z
    .boolean()
    .default(defaultConfig.onboarding_generation_contract_template_done)
    .describe(describeField({ label: 'Шаг соглашения о генерации выполнен', visible: false })),
  onboarding_generator_offer_template_done: z
    .boolean()
    .default(defaultConfig.onboarding_generator_offer_template_done)
    .describe(describeField({ label: 'Шаг шаблона оферты генератора выполнен', visible: false })),
  onboarding_blagorost_provision_done: z
    .boolean()
    .default(defaultConfig.onboarding_blagorost_provision_done)
    .describe(describeField({ label: 'Шаг положения Благорост выполнен', visible: false })),
  onboarding_blagorost_offer_template_done: z
    .boolean()
    .default(defaultConfig.onboarding_blagorost_offer_template_done)
    .describe(describeField({ label: 'Шаг предложения Благорост выполнен', visible: false })),

});

// Автоматическое создание типа IConfig на основе Zod-схемы
export type IConfig = z.infer<typeof Schema>;

// Доменные сервисы
import { IssueIdGenerationService } from './domain/services/issue-id-generation.service';
import { UdataDocumentParametersService, UDATA_DOCUMENT_PARAMETERS_SERVICE } from './domain/services/udata-document-parameters.service';

// Инфраструктурные адаптеры
import { UdataDocumentParametersAdapter } from './infrastructure/adapters/udata-document-parameters.adapter';
import { CapitalInterProjectCapitalClearanceAdapter } from './infrastructure/inter/capital-inter-project-capital-clearance.adapter';
import { UDATA_DOCUMENT_PARAMETERS_PORT } from '~/domain/common/ports/udata-document-parameters.port';
import {
  AGREEMENT_REGISTRATION_PORT,
  type AgreementRegistrationPort,
} from '~/domain/registration/ports/agreement-registration.port';
import { registerCapitalInAgreementRegistry } from './application/registration/register-capital-in-agreement-registry';
import {
  ONBOARDING_STEP_REGISTRATION_PORT,
  type OnboardingStepRegistrationPort,
} from '~/domain/onboarding/ports/onboarding-step-registration.port';
import { registerCapitalOnboardingSteps } from './application/onboarding/register-capital-onboarding-steps';

// Репозитории
import { ProjectTypeormRepository } from './infrastructure/repositories/project.typeorm-repository';
import { ContributorTypeormRepository } from './infrastructure/repositories/contributor.typeorm-repository';
import { AppendixTypeormRepository } from './infrastructure/repositories/appendix.typeorm-repository';
import { InvestTypeormRepository } from './infrastructure/repositories/invest.typeorm-repository';
import { ProgramPropertyTypeormRepository } from './infrastructure/repositories/program-property.typeorm-repository';
import { ProgramWithdrawTypeormRepository } from './infrastructure/repositories/program-withdraw.typeorm-repository';
import { ProjectPropertyTypeormRepository } from './infrastructure/repositories/project-property.typeorm-repository';
import { ProgramWalletTypeormRepository } from './infrastructure/repositories/program-wallet.typeorm-repository';
import { CycleTypeormRepository } from './infrastructure/repositories/cycle.typeorm-repository';
import { IssueTypeormRepository } from './infrastructure/repositories/issue.typeorm-repository';
import { ProcessTemplateTypeormRepository } from './infrastructure/repositories/process-template.typeorm-repository';
import { ProcessInstanceTypeormRepository } from './infrastructure/repositories/process-instance.typeorm-repository';
import { PROCESS_TEMPLATE_REPOSITORY, PROCESS_INSTANCE_REPOSITORY } from './domain/repositories/process.repository';
import { ProcessService } from './application/services/process.service';
import { ProcessResolver } from './application/resolvers/process.resolver';
import { CommentTypeormRepository } from './infrastructure/repositories/comment.typeorm-repository';
import { StoryTypeormRepository } from './infrastructure/repositories/story.typeorm-repository';
import { VoteTypeormRepository } from './infrastructure/repositories/vote.typeorm-repository';
import { DebtTypeormRepository } from './infrastructure/repositories/debt.typeorm-repository';
import { ResultTypeormRepository } from './infrastructure/repositories/result.typeorm-repository';
import { ExpenseTypeormRepository } from './infrastructure/repositories/expense.typeorm-repository';
import { CommitTypeormRepository } from './infrastructure/repositories/commit.typeorm-repository';
import { StateTypeormRepository } from './infrastructure/repositories/state.typeorm-repository';
import { TimeEntryTypeormRepository } from './infrastructure/repositories/time-entry.typeorm-repository';
import { SegmentTypeormRepository } from './infrastructure/repositories/segment.typeorm-repository';

// GitHub (маркеры коммитов)
import { GitHubService } from './infrastructure/services/github.service';
import { GitHubSyncSchedulerService } from './infrastructure/services/github-sync-scheduler.service';
import { ProgramShareRegistrationSchedulerService } from './infrastructure/services/program-share-registration-scheduler.service';
import { ProgramShareRegistrationService } from './application/services/program-share-registration.service';
import { ProgramShareRegistrationOnUserWalletDeltaListener } from './application/listeners/program-share-registration-on-user-wallet-delta.listener';
import { CapitalDevelopmentRepositoryGitSyncService } from './application/services/capital-development-repository-git-sync.service';
import { CapitalGithubExtensionLifecycleListener } from './application/listeners/capital-github-extension-lifecycle.listener';
import { GitCommitMarkersSyncService } from './application/services/git-commit-markers-sync.service';
import { IssueLinkedGitCommitTypeormRepository } from './infrastructure/repositories/issue-linked-git-commit.typeorm-repository';
import { GithubBranchCommitSyncStateTypeormRepository } from './infrastructure/repositories/github-branch-commit-sync-state.typeorm-repository';
import { ISSUE_LINKED_GIT_COMMIT_REPOSITORY } from './domain/repositories/issue-linked-git-commit.repository';
import { GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY } from './domain/repositories/github-branch-commit-sync-state.repository';
// Blockchain синхронизация
import { ProjectDeltaMapper } from './infrastructure/blockchain/mappers/project-delta.mapper';
import { ProjectSyncService } from './application/syncers/project-sync.service';
import { CapitalProjectMatrixRoomAssignedListener } from './application/listeners/capital-project-matrix-room-assigned.listener';
import { ChatCoopMatrixUserLinkedCapitalProjectRoomsListener } from './application/listeners/chatcoop-matrix-user-linked-capital-project-rooms.listener';
import { SegmentDeltaMapper } from './infrastructure/blockchain/mappers/segment-delta.mapper';
import { SegmentSyncService } from './application/syncers/segment-sync.service';

import { ContributorDeltaMapper } from './infrastructure/blockchain/mappers/contributor-delta.mapper';
import { ContributorSyncService } from './application/syncers/contributor-sync.service';
import { AppendixDeltaMapper } from './infrastructure/blockchain/mappers/appendix-delta.mapper';
import { AppendixSyncService } from './application/syncers/appendix-sync.service';
import { DebtDeltaMapper } from './infrastructure/blockchain/mappers/debt-delta.mapper';
import { DebtSyncService } from './application/syncers/debt-sync.service';
import { ExpenseDeltaMapper } from './infrastructure/blockchain/mappers/expense-delta.mapper';
import { ExpenseSyncService } from './application/syncers/expense-sync.service';
import { InvestDeltaMapper } from './infrastructure/blockchain/mappers/invest-delta.mapper';
import { InvestSyncService } from './application/syncers/invest-sync.service';
import { ResultDeltaMapper } from './infrastructure/blockchain/mappers/result-delta.mapper';
import { ResultSyncService } from './application/syncers/result-sync.service';
import { StateDeltaMapper } from './infrastructure/blockchain/mappers/state-delta.mapper';
import { StateSyncService } from './application/syncers/state-sync.service';
import { VoteDeltaMapper } from './infrastructure/blockchain/mappers/vote-delta.mapper';
import { VoteSyncService } from './application/syncers/vote-sync.service';
import { ProgramPropertyDeltaMapper } from './infrastructure/blockchain/mappers/program-property-delta.mapper';
import { ProgramPropertySyncService } from './application/syncers/program-property-sync.service';
import { ProgramWithdrawDeltaMapper } from './infrastructure/blockchain/mappers/program-withdraw-delta.mapper';
import { ProgramWithdrawSyncService } from './application/syncers/program-withdraw-sync.service';
import { ProjectPropertyDeltaMapper } from './infrastructure/blockchain/mappers/project-property-delta.mapper';
import { ProjectPropertySyncService } from './application/syncers/project-property-sync.service';
import { ProgramWalletDeltaMapper } from './infrastructure/blockchain/mappers/program-wallet-delta.mapper';
import { ProgramWalletSyncService } from './application/syncers/program-wallet-sync.service';
import { CapitalSyncInteractor } from './application/use-cases/capital-sync.interactor';

// Services
import { CapitalContractInfoService } from './infrastructure/services/capital-contract-info.service';
import { ContractManagementService } from './application/services/contract-management.service';
import { ParticipationManagementService } from './application/services/participation-management.service';
import { ContributorMapperService } from './application/services/contributor-mapper.service';
import { ProjectManagementService } from './application/services/project-management.service';
import { ProjectMapperService } from './application/services/project-mapper.service';
import { CommitMapperService } from './application/services/commit-mapper.service';
import { GitService } from './application/services/git.service';
import { GenerationService } from './application/services/generation.service';
import { ComponentMatrixAnnouncementService } from './application/services/component-matrix-announcement.service';
import { IssuePermissionsService } from './application/services/issue-permissions.service';
import { ProjectPermissionsService } from './application/services/project-permissions.service';
import { IssueAccessPolicyService } from './domain/services/access-policy.service';
import { PermissionsService } from './application/services/permissions.service';
import { InvestsManagementService } from './application/services/invests-management.service';
import { DebtManagementService } from './application/services/debt-management.service';
import { PropertyManagementService } from './application/services/property-management.service';
import { VotingService } from './application/services/voting.service';
import { ResultSubmissionService } from './application/services/result-submission.service';
import { DistributionManagementService } from './application/services/distribution-management.service';
import { ExpensesManagementService } from './application/services/expenses-management.service';
import { ProgramExpensesManagementService } from './application/services/program-expenses-management.service';
import { ContributorAccountSyncService } from './application/services/contributor-account-sync.service';
import { CommitSyncService } from './application/syncers/commit-sync.service';
import { CommitDeltaMapper } from './infrastructure/blockchain/mappers/commit-delta.mapper';
import { TimeTrackingService } from './application/services/time-tracking.service';
import { SegmentsService } from './application/services/segments.service';
import { SegmentMapper } from './infrastructure/mappers/segment.mapper';
import { ResultMapper } from './infrastructure/mappers/result.mapper';
import { TimeTrackingSchedulerService } from './infrastructure/services/time-tracking-scheduler.service';
import { GamificationSchedulerService } from './infrastructure/services/gamification-scheduler.service';
import { LogService } from './application/services/log.service';

// CAPITAL Application Dependencies
import { CapitalBlockchainAdapter } from './infrastructure/blockchain/adapters/capital-blockchain.adapter';
import { CAPITAL_BLOCKCHAIN_PORT } from './domain/interfaces/capital-blockchain.port';
import { RegistrationModule } from '~/application/registration/registration.module';
import { CapitalRegistrationService } from './application/registration/services/capital-registration.service';
import { CapitalRegistrationResolver } from './application/registration/resolvers/capital-registration.resolver';

// Символы для DI
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository';
import { CONTRIBUTOR_REPOSITORY } from './domain/repositories/contributor.repository';
import { APPENDIX_REPOSITORY } from './domain/repositories/appendix.repository';
import { INVEST_REPOSITORY } from './domain/repositories/invest.repository';
import { PROGRAM_PROPERTY_REPOSITORY } from './domain/repositories/program-property.repository';
import { PROGRAM_WITHDRAW_REPOSITORY } from './domain/repositories/program-withdraw.repository';
import { PROJECT_PROPERTY_REPOSITORY } from './domain/repositories/project-property.repository';
import { PROGRAM_WALLET_REPOSITORY } from './domain/repositories/program-wallet.repository';
import { CYCLE_REPOSITORY } from './domain/repositories/cycle.repository';
import { ISSUE_REPOSITORY } from './domain/repositories/issue.repository';
import { COMMENT_REPOSITORY } from './domain/repositories/comment.repository';
import { STORY_REPOSITORY } from './domain/repositories/story.repository';
import { VOTE_REPOSITORY } from './domain/repositories/vote.repository';
import { DEBT_REPOSITORY } from './domain/repositories/debt.repository';
import { RESULT_REPOSITORY } from './domain/repositories/result.repository';
import { EXPENSE_REPOSITORY } from './domain/repositories/expense.repository';
import { COMMIT_REPOSITORY } from './domain/repositories/commit.repository';
import { STATE_REPOSITORY } from './domain/repositories/state.repository';
import { TIME_ENTRY_REPOSITORY } from './domain/repositories/time-entry.repository';
import { SEGMENT_REPOSITORY } from './domain/repositories/segment.repository';

import { ContractManagementResolver } from './application/resolvers/contract-management.resolver';
import { ParticipationManagementResolver } from './application/resolvers/participation-management.resolver';
import { ProjectManagementResolver } from './application/resolvers/project-management.resolver';
import { GenerationResolver } from './application/resolvers/generation.resolver';
import { InvestsManagementResolver } from './application/resolvers/invests-management.resolver';
import { DebtManagementResolver } from './application/resolvers/debt-management.resolver';
import { PropertyManagementResolver } from './application/resolvers/property-management.resolver';
import { TimeTrackerResolver } from './application/resolvers/time-tracker.resolver';
import { VotingResolver } from './application/resolvers/voting.resolver';
import { ResultSubmissionResolver } from './application/resolvers/result-submission.resolver';
import { DistributionManagementResolver } from './application/resolvers/distribution-management.resolver';
import { ExpensesManagementResolver } from './application/resolvers/expenses-management.resolver';
import { ProgramExpensesResolver } from './application/resolvers/program-expenses.resolver';
import { SegmentsResolver } from './application/resolvers/segments.resolver';
import { LogResolver } from './application/resolvers/log.resolver';
import { MutationLogMapperService } from './application/services/mutation-log-mapper.service';
import { CapitalOnboardingService } from './application/services/onboarding.service';
import { CapitalOnboardingEventsService } from './application/services/onboarding-events.service';
import { CapitalOnboardingResolver } from './application/resolvers/onboarding.resolver';

import { ParticipationManagementInteractor } from './application/use-cases/participation-management.interactor';
import { ClearanceManagementInteractor } from './application/use-cases/clearance-management.interactor';
import { ProjectManagementInteractor } from './application/use-cases/project-management.interactor';
import { GenerationInteractor } from './application/use-cases/generation.interactor';
import { TimeTrackingInteractor } from './application/use-cases/time-tracking.interactor';
import { InvestsManagementInteractor } from './application/use-cases/invests-management.interactor';
import { DebtManagementInteractor } from './application/use-cases/debt-management.interactor';
import { PropertyManagementInteractor } from './application/use-cases/property-management.interactor';
import { VotingInteractor } from './application/use-cases/voting.interactor';
import { ResultSubmissionInteractor } from './application/use-cases/result-submission.interactor';
import { DistributionManagementInteractor } from './application/use-cases/distribution-management.interactor';
import { ContractManagementInteractor } from './application/use-cases/contract-management.interactor';
import { ExpensesManagementInteractor } from './application/use-cases/expenses-management.interactor';
import { SegmentsInteractor } from './application/use-cases/segments.interactor';
import { LogInteractor } from './application/use-cases/log.interactor';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { config as configEnv } from '~/config';
import { resolveCapitalGithubApiPlainToken } from './application/utils/capital-github-token';
import { FreeDecisionDomainModule } from '~/domain/free-decision/free-decision.module';
import { FreeDecisionInfrastructureModule } from '~/infrastructure/free-decision/free-decision-infrastructure.module';
import { DecisionTrackingInfrastructureModule } from '~/infrastructure/decision-tracking/decision-tracking-infrastructure.module';
import { WalletModule } from '~/application/wallet/wallet.module';
// Конфигурация модуля теперь использует IConfig из схемы
// EventEmitter: глобальный EventsInfrastructureModule (forRoot один раз в app)

@Injectable()
export class CapitalPlugin extends BaseExtModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    private readonly contractManagementService: ContractManagementService,
    private readonly logger: WinstonLoggerService,
    private readonly syncInteractor: CapitalSyncInteractor,
    private readonly githubSyncScheduler: GitHubSyncSchedulerService,
    private readonly programShareRegistrationScheduler: ProgramShareRegistrationSchedulerService,
    private readonly githubService: GitHubService,
    private readonly gitService: GitService,
    private readonly capitalDevelopmentRepositoryGitSync: CapitalDevelopmentRepositoryGitSyncService,
    @Inject(AGREEMENT_REGISTRATION_PORT) private readonly agreementRegistrationPort: AgreementRegistrationPort,
    @Inject(ONBOARDING_STEP_REGISTRATION_PORT)
    private readonly onboardingStepRegistration: OnboardingStepRegistrationPort
  ) {
    super();
    this.logger.setContext(CapitalPlugin.name);
  }


  name = 'capital';
  plugin!: ExtensionDomainEntity<IConfig>; // ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(config?: IConfig): Promise<void> {
    this.logger.log('Модуль благороста инициализирован');
    this.capitalDevelopmentRepositoryGitSync.abortAllInFlightRepositorySyncs();

    // Загружаем конфигурацию расширения
    const pluginData = await this.extensionRepository.findByName(this.name);
    if (!pluginData) {
      this.logger.error(`Конфигурация расширения ${this.name} не найдена`);
      return;
    }

    // Сливаем загруженную конфигурацию с дефолтными значениями
    this.plugin = {
      ...pluginData,
      config: { ...defaultConfig, ...pluginData.config },
    };

    // Если передана новая конфигурация через параметр (при restart), используем её
    // Сливаем с дефолтными значениями для обеспечения корректных типов
    const extensionConfig = { ...defaultConfig, ...(config || this.plugin.config) };

    const { github_api_token_encrypted: _ghEnc, ...extensionConfigLogSafe } = extensionConfig;
    this.logger.log(`Инициализация ${this.name} с конфигурацией`, {
      ...extensionConfigLogSafe,
      github_api_token_encrypted: _ghEnc ? '[задан]' : '[пусто]',
    });

    const ghPlain = resolveCapitalGithubApiPlainToken(extensionConfig.github_api_token_encrypted);
    this.githubService.reconfigureWithCapitalExtensionEncrypted(extensionConfig.github_api_token_encrypted);
    this.gitService.reconfigureWithCapitalExtensionEncrypted(extensionConfig.github_api_token_encrypted);
    if (ghPlain) {
      this.logger.log('Токен GitHub для Capital: из конфигурации расширения или GITHUB_TOKEN');
    }

    // Синхронизируем конфигурацию с контрактом
    try {
      const coopname = configEnv.coopname;
      const currentState = await this.contractManagementService.getState({ coopname });

      // Проверяем, нужно ли устанавливать/обновлять конфигурацию контракта
      const contractConfig = currentState?.config;

      // Получаем финальные значения для сравнения и отправки
      const finalConfig = {
        authors_voting_percent: Number(extensionConfig.authors_voting_percent ?? defaultConfig.authors_voting_percent),
        coordinator_bonus_percent: Number(
          extensionConfig.coordinator_bonus_percent ?? defaultConfig.coordinator_bonus_percent
        ),
        coordinator_invite_validity_days: Number(
          extensionConfig.coordinator_invite_validity_days ?? defaultConfig.coordinator_invite_validity_days
        ),
        creators_voting_percent: Number(extensionConfig.creators_voting_percent ?? defaultConfig.creators_voting_percent),
        expense_pool_percent: Number(extensionConfig.expense_pool_percent ?? defaultConfig.expense_pool_percent),
        voting_period_in_days: Number(extensionConfig.voting_period_in_days ?? defaultConfig.voting_period_in_days),
        energy_decay_rate_per_day: Number(
          extensionConfig.energy_decay_rate_per_day ?? defaultConfig.energy_decay_rate_per_day
        ),
        level_depth_base: Number(extensionConfig.level_depth_base ?? defaultConfig.level_depth_base),
        level_growth_coefficient: Number(extensionConfig.level_growth_coefficient ?? defaultConfig.level_growth_coefficient),
        energy_gain_coefficient: Number(extensionConfig.energy_gain_coefficient ?? defaultConfig.energy_gain_coefficient),
      };

      // Сравниваем с приведением типов
      const needsUpdate =
        !contractConfig || // Конфигурация не установлена в контракте
        Number(contractConfig.authors_voting_percent || 0) !== finalConfig.authors_voting_percent ||
        Number(contractConfig.coordinator_bonus_percent || 0) !== finalConfig.coordinator_bonus_percent ||
        Number(contractConfig.coordinator_invite_validity_days || 0) !== finalConfig.coordinator_invite_validity_days ||
        Number(contractConfig.creators_voting_percent || 0) !== finalConfig.creators_voting_percent ||
        Number(contractConfig.expense_pool_percent || 0) !== finalConfig.expense_pool_percent ||
        Number(contractConfig.voting_period_in_days || 0) !== finalConfig.voting_period_in_days ||
        Number(contractConfig.energy_decay_rate_per_day || 0) !== finalConfig.energy_decay_rate_per_day ||
        Number(contractConfig.level_depth_base || 0) !== finalConfig.level_depth_base ||
        Number(contractConfig.level_growth_coefficient || 0) !== finalConfig.level_growth_coefficient ||
        Number(contractConfig.energy_gain_coefficient || 0) !== finalConfig.energy_gain_coefficient;

      if (needsUpdate) {
        const action = contractConfig ? 'обновление' : 'установка начальной';
        this.logger.log(`Выполняем ${action} конфигурации контракта CAPITAL`);

        await this.contractManagementService.setConfig({
          coopname,
          config: finalConfig,
        });

        this.logger.log(`Конфигурация контракта CAPITAL успешно ${contractConfig ? 'обновлена' : 'установлена'}`);
      } else {
        this.logger.log('Конфигурация контракта CAPITAL уже актуальна');
      }
    } catch (error: any) {
      this.logger.error(`Не удалось синхронизировать конфигурацию с контрактом CAPITAL: ${error.message}`, error.stack);
      // Не бросаем ошибку, чтобы не блокировать запуск модуля
    }

    // Инициализируем синхронизацию с блокчейном
    try {
      await this.syncInteractor.initializeSync();
      this.logger.log('Синхронизация благороста с блокчейном инициализирована');
    } catch (error: any) {
      this.logger.error(
        `Не удалось инициализировать синхронизацию благороста с блокчейном: ${error.message}`,
        error.stack
      );
      // Не бросаем ошибку, чтобы не блокировать запуск модуля
    }

    // Опрос маркеров Git по URL из проектов/компонентов (PRD §6.2.1); токен — конфиг Capital (зашифр.) или GITHUB_TOKEN.
    const pollMinutes = Number(extensionConfig.github_sync_poll_interval_minutes)

    try {
      await this.githubSyncScheduler.stop()
      const syncBranch =
        typeof extensionConfig.github_sync_branch === 'string' && extensionConfig.github_sync_branch.trim()
          ? extensionConfig.github_sync_branch.trim()
          : defaultConfig.github_sync_branch

      await this.githubSyncScheduler.startFromExtensionConfig({
        githubSyncBranch: syncBranch,
        pollIntervalMinutes: Number.isFinite(pollMinutes) ? pollMinutes : defaultConfig.github_sync_poll_interval_minutes,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Не удалось настроить GitHub синхронизацию: ${message}`, stack)
    }

    const shareMinutes = Number(extensionConfig.program_share_registration_interval_minutes)
    try {
      await this.programShareRegistrationScheduler.stop()
      await this.programShareRegistrationScheduler.startFromExtensionConfig({
        intervalMinutes: Number.isFinite(shareMinutes)
          ? shareMinutes
          : defaultConfig.program_share_registration_interval_minutes,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      this.logger.error(`Не удалось настроить планировщик regshare: ${message}`, stack)
    }

    // Регистрация шагов онбординга capital в платформенном реестре
    try {
      registerCapitalOnboardingSteps(this.onboardingStepRegistration);
      this.logger.log('[CAPITAL.ONBOARDING] зарегистрировано 5 шагов онбординга capital');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Не удалось зарегистрировать шаги онбординга capital: ${message}`,
        stack
      );
    }

    // L2: регистрация оферт и программ capital в платформенном реестре.
    // Если L1 ещё не завершён — реестр остаётся пустым, SignUp не предлагает
    // программы capital (раздел 4.1 req 44 проекта 13).
    try {
      const registered = registerCapitalInAgreementRegistry(this.agreementRegistrationPort, extensionConfig as IConfig);
      if (registered) {
        this.logger.log('[CAPITAL.REGISTRY] зарегистрировано 2 оферты + 2 программы capital');
      } else {
        this.logger.log(
          '[CAPITAL.REGISTRY] L1 онбординг ещё не завершён — оферты и программы не регистрируются'
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Не удалось зарегистрировать capital в AgreementRegistry: ${message}`, stack);
    }
  }
}

@Module({
  imports: [
    CapitalDatabaseModule,
    AccountInfrastructureModule,
    DocumentDomainModule,
    DocumentModule,
    DocumentInfrastructureModule,
    VaultDomainModule,
    FreeDecisionDomainModule,
    FreeDecisionInfrastructureModule,
    DecisionTrackingInfrastructureModule,
    WalletModule,
    forwardRef(() => RegistrationModule),
    RegistrationInfrastructureModule,
  ],
  providers: [
    // Plugin
    CapitalPlugin,
    CapitalRegistrationService,
    CapitalRegistrationResolver,

// Domain Services
IssueIdGenerationService,
{
  provide: UDATA_DOCUMENT_PARAMETERS_SERVICE,
  useClass: UdataDocumentParametersService,
},

    // Services
    CapitalContractInfoService,
    ContractManagementService,
    ParticipationManagementService,
    ContributorMapperService,
    CapitalDevelopmentRepositoryGitSyncService,
    CapitalGithubExtensionLifecycleListener,
    ProjectManagementService,
    ProjectMapperService,
    CommitMapperService,
    GitService,
    GenerationService,
    ComponentMatrixAnnouncementService,
    IssuePermissionsService,
    ProjectPermissionsService,
    IssueAccessPolicyService,
    PermissionsService,
    InvestsManagementService,
    DebtManagementService,
    PropertyManagementService,
    VotingService,
    ResultSubmissionService,
    DistributionManagementService,
    ExpensesManagementService,
    ProgramExpensesManagementService,
    ContributorAccountSyncService,
    SegmentsService,
    SegmentMapper,
    ResultMapper,
    LogService,
    MutationLogMapperService,
    CapitalOnboardingService,
    CapitalOnboardingEventsService,

    // CAPITAL Application Layer Dependencies
    {
      provide: CAPITAL_BLOCKCHAIN_PORT,
      useClass: CapitalBlockchainAdapter,
    },

    // Blockchain Sync Services
    ProjectDeltaMapper,
    ProjectSyncService,
    CapitalProjectMatrixRoomAssignedListener,
    ChatCoopMatrixUserLinkedCapitalProjectRoomsListener,
    ContributorDeltaMapper,
    ContributorSyncService,
    AppendixDeltaMapper,
    AppendixSyncService,
    DebtDeltaMapper,
    DebtSyncService,
    ExpenseDeltaMapper,
    ExpenseSyncService,
    InvestDeltaMapper,
    InvestSyncService,
    ResultDeltaMapper,
    ResultSyncService,
    StateDeltaMapper,
    StateSyncService,
    VoteDeltaMapper,
    VoteSyncService,
    ProgramPropertyDeltaMapper,
    ProgramPropertySyncService,
    ProgramWithdrawDeltaMapper,
    ProgramWithdrawSyncService,
    ProjectPropertyDeltaMapper,
    ProjectPropertySyncService,
    ProgramWalletDeltaMapper,
    ProgramWalletSyncService,
    SegmentDeltaMapper,
    SegmentSyncService,
    CommitSyncService,
    CommitDeltaMapper,
    ContractManagementResolver,
    ParticipationManagementResolver,
    ProjectManagementResolver,
    GenerationResolver,
    InvestsManagementResolver,
    DebtManagementResolver,
    PropertyManagementResolver,
    VotingResolver,
    ResultSubmissionResolver,
    DistributionManagementResolver,
    ExpensesManagementResolver,
    ProgramExpensesResolver,
    SegmentsResolver,
    TimeTrackerResolver,
    LogResolver,
    CapitalOnboardingResolver,
    // Repositories
    {
      provide: PROJECT_REPOSITORY,
      useClass: ProjectTypeormRepository,
    },
    {
      provide: CONTRIBUTOR_REPOSITORY,
      useClass: ContributorTypeormRepository,
    },
    {
      provide: APPENDIX_REPOSITORY,
      useClass: AppendixTypeormRepository,
    },
    {
      provide: INVEST_REPOSITORY,
      useClass: InvestTypeormRepository,
    },
    {
      provide: PROGRAM_PROPERTY_REPOSITORY,
      useClass: ProgramPropertyTypeormRepository,
    },
    {
      provide: PROGRAM_WITHDRAW_REPOSITORY,
      useClass: ProgramWithdrawTypeormRepository,
    },
    {
      provide: PROJECT_PROPERTY_REPOSITORY,
      useClass: ProjectPropertyTypeormRepository,
    },
    {
      provide: PROGRAM_WALLET_REPOSITORY,
      useClass: ProgramWalletTypeormRepository,
    },
    {
      provide: CYCLE_REPOSITORY,
      useClass: CycleTypeormRepository,
    },
    {
      provide: ISSUE_REPOSITORY,
      useClass: IssueTypeormRepository,
    },
    {
      provide: PROCESS_TEMPLATE_REPOSITORY,
      useClass: ProcessTemplateTypeormRepository,
    },
    {
      provide: PROCESS_INSTANCE_REPOSITORY,
      useClass: ProcessInstanceTypeormRepository,
    },
    ProcessService,
    ProcessResolver,
    {
      provide: COMMENT_REPOSITORY,
      useClass: CommentTypeormRepository,
    },
    {
      provide: STORY_REPOSITORY,
      useClass: StoryTypeormRepository,
    },
    {
      provide: VOTE_REPOSITORY,
      useClass: VoteTypeormRepository,
    },
    {
      provide: DEBT_REPOSITORY,
      useClass: DebtTypeormRepository,
    },
    {
      provide: RESULT_REPOSITORY,
      useClass: ResultTypeormRepository,
    },
    {
      provide: EXPENSE_REPOSITORY,
      useClass: ExpenseTypeormRepository,
    },
    {
      provide: COMMIT_REPOSITORY,
      useClass: CommitTypeormRepository,
    },
    {
      provide: STATE_REPOSITORY,
      useClass: StateTypeormRepository,
    },
    {
      provide: TIME_ENTRY_REPOSITORY,
      useClass: TimeEntryTypeormRepository,
    },
    {
      provide: SEGMENT_REPOSITORY,
      useClass: SegmentTypeormRepository,
    },

    // GitHub (маркеры коммитов)
    GitHubService,
    GitHubSyncSchedulerService,
    ProgramShareRegistrationService,
    ProgramShareRegistrationSchedulerService,
    ProgramShareRegistrationOnUserWalletDeltaListener,
    GitCommitMarkersSyncService,
    {
      provide: ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
      useClass: IssueLinkedGitCommitTypeormRepository,
    },
    {
      provide: GITHUB_BRANCH_COMMIT_SYNC_STATE_REPOSITORY,
      useClass: GithubBranchCommitSyncStateTypeormRepository,
    },

    // Services that depend on repositories
    TimeTrackingService,
    TimeTrackingSchedulerService,
    GamificationSchedulerService,

    // Use Cases
    ContractManagementInteractor,
    ParticipationManagementInteractor,
    ClearanceManagementInteractor,
    ProjectManagementInteractor,
    GenerationInteractor,
    TimeTrackingInteractor,
    InvestsManagementInteractor,
    DebtManagementInteractor,
    PropertyManagementInteractor,
    VotingInteractor,
    ResultSubmissionInteractor,
    DistributionManagementInteractor,
    ExpensesManagementInteractor,
    SegmentsInteractor,
    CapitalSyncInteractor,
    LogInteractor,

    // Infrastructure Adapters (после всех сервисов)
    {
      provide: UDATA_DOCUMENT_PARAMETERS_PORT,
      useClass: UdataDocumentParametersAdapter,
    },
    CapitalInterProjectCapitalClearanceAdapter,
  ],
  exports: [CapitalPlugin, UDATA_DOCUMENT_PARAMETERS_PORT, CapitalInterProjectCapitalClearanceAdapter],
})
export class CapitalPluginModule {
  constructor(private readonly capitalPlugin: CapitalPlugin) {}

  async initialize(config?: IConfig) {
    await this.capitalPlugin.initialize(config);
  }
}
