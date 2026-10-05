import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import { ContentRevisionTypeormEntity } from '../entities/content-revision.typeorm-entity';
import { FavoriteTypeormEntity } from '../entities/favorite.typeorm-entity';
import { GithubBranchCommitSyncStateTypeormEntity } from '../entities/github-branch-commit-sync-state.typeorm-entity';
import { GithubCommMessageCursorTypeormEntity } from '../entities/github-comm-message-cursor.typeorm-entity';
import { GithubCommTranscriptionCursorTypeormEntity } from '../entities/github-comm-transcription-cursor.typeorm-entity';
import { GitHubFileIndexTypeormEntity } from '../entities/github-file-index.typeorm-entity';
import { IssueLinkedGitCommitShaTypeormEntity } from '../entities/issue-linked-git-commit-sha.typeorm-entity';
import { IssueLinkedGitCommitTypeormEntity } from '../entities/issue-linked-git-commit.typeorm-entity';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import { ProcessTemplateTypeormEntity } from '../entities/process-template.entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import { CommentTypeormEntity } from '../entities/comment.typeorm-entity';
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import { ComponentMetricTypeormEntity } from '../entities/component-metric.typeorm-entity';
import { ContributorTypeormEntity } from '../entities/contributor.typeorm-entity';
import { CycleTypeormEntity } from '../entities/cycle.typeorm-entity';
import { DebtTypeormEntity } from '../entities/debt.typeorm-entity';
import { ExpenseTypeormEntity } from '../entities/expense.typeorm-entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import { IssueMetricBindingTypeormEntity } from '../entities/issue-metric-binding.typeorm-entity';
import { IssueTypeormEntity } from '../entities/issue.typeorm-entity';
import { MeasureTypeormEntity } from '../entities/measure.typeorm-entity';
import { MetricContributionTypeormEntity } from '../entities/metric-contribution.typeorm-entity';
import { ProgramPropertyTypeormEntity } from '../entities/program-property.typeorm-entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import { ProgramWithdrawTypeormEntity } from '../entities/program-withdraw.typeorm-entity';
import { ProjectPropertyTypeormEntity } from '../entities/project-property.typeorm-entity';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { ResultTypeormEntity } from '../entities/result.typeorm-entity';
import { SegmentTypeormEntity } from '../entities/segment.typeorm-entity';
import { StateTypeormEntity } from '../entities/state.typeorm-entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';
import { TimeEntryEntity } from '../entities/time-entry.entity';
import { TimerSessionEntity } from '../entities/timer-session.entity';
import { VoteTypeormEntity } from '../entities/vote.typeorm-entity';

/**
 * Шлюзы таблиц расширения: адаптеры хранилищ работают с записями целиком
 * (прочитал, поправил, сохранил), запросы к базе идут через Kysely.
 */
export const CAPITAL_CONTENT_REVISION_STORE = Symbol('Capital.CAPITAL_CONTENT_REVISION_STORE');
export const CAPITAL_FAVORITE_STORE = Symbol('Capital.CAPITAL_FAVORITE_STORE');
export const CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE = Symbol('Capital.CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE');
export const CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE = Symbol('Capital.CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE');
export const CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE = Symbol('Capital.CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE');
export const CAPITAL_GITHUB_FILE_INDEX_STORE = Symbol('Capital.CAPITAL_GITHUB_FILE_INDEX_STORE');
export const CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE = Symbol('Capital.CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE');
export const CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE = Symbol('Capital.CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE');
export const CAPITAL_PROCESS_INSTANCE_STORE = Symbol('Capital.CAPITAL_PROCESS_INSTANCE_STORE');
export const CAPITAL_PROCESS_TEMPLATE_STORE = Symbol('Capital.CAPITAL_PROCESS_TEMPLATE_STORE');

export const CAPITAL_APPENDIX_STORE = Symbol('Capital.CAPITAL_APPENDIX_STORE');
export const CAPITAL_COMMENT_STORE = Symbol('Capital.CAPITAL_COMMENT_STORE');
export const CAPITAL_COMMIT_STORE = Symbol('Capital.CAPITAL_COMMIT_STORE');
export const CAPITAL_COMPONENT_METRIC_STORE = Symbol('Capital.CAPITAL_COMPONENT_METRIC_STORE');
export const CAPITAL_CONTRIBUTOR_STORE = Symbol('Capital.CAPITAL_CONTRIBUTOR_STORE');
export const CAPITAL_CYCLE_STORE = Symbol('Capital.CAPITAL_CYCLE_STORE');
export const CAPITAL_DEBT_STORE = Symbol('Capital.CAPITAL_DEBT_STORE');
export const CAPITAL_EXPENSE_STORE = Symbol('Capital.CAPITAL_EXPENSE_STORE');
export const CAPITAL_INVEST_STORE = Symbol('Capital.CAPITAL_INVEST_STORE');
export const CAPITAL_ISSUE_METRIC_BINDING_STORE = Symbol('Capital.CAPITAL_ISSUE_METRIC_BINDING_STORE');
export const CAPITAL_ISSUE_STORE = Symbol('Capital.CAPITAL_ISSUE_STORE');
export const CAPITAL_MEASURE_STORE = Symbol('Capital.CAPITAL_MEASURE_STORE');
export const CAPITAL_METRIC_CONTRIBUTION_STORE = Symbol('Capital.CAPITAL_METRIC_CONTRIBUTION_STORE');
export const CAPITAL_PROGRAM_PROPERTY_STORE = Symbol('Capital.CAPITAL_PROGRAM_PROPERTY_STORE');
export const CAPITAL_PROGRAM_WALLET_STORE = Symbol('Capital.CAPITAL_PROGRAM_WALLET_STORE');
export const CAPITAL_PROGRAM_WITHDRAW_STORE = Symbol('Capital.CAPITAL_PROGRAM_WITHDRAW_STORE');
export const CAPITAL_PROJECT_PROPERTY_STORE = Symbol('Capital.CAPITAL_PROJECT_PROPERTY_STORE');
export const CAPITAL_PROJECT_STORE = Symbol('Capital.CAPITAL_PROJECT_STORE');
export const CAPITAL_RESULT_STORE = Symbol('Capital.CAPITAL_RESULT_STORE');
export const CAPITAL_SEGMENT_STORE = Symbol('Capital.CAPITAL_SEGMENT_STORE');
export const CAPITAL_STATE_STORE = Symbol('Capital.CAPITAL_STATE_STORE');
export const CAPITAL_STORY_STORE = Symbol('Capital.CAPITAL_STORY_STORE');
export const CAPITAL_TIME_ENTRY_STORE = Symbol('Capital.CAPITAL_TIME_ENTRY_STORE');
export const CAPITAL_TIMER_SESSION_STORE = Symbol('Capital.CAPITAL_TIMER_SESSION_STORE');
export const CAPITAL_VOTE_STORE = Symbol('Capital.CAPITAL_VOTE_STORE');
export const capitalStoreProviders: Provider[] = [
  {
    provide: CAPITAL_CONTENT_REVISION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ContentRevisionTypeormEntity>(db, {
        table: 'capital_content_revisions',
        primaryKey: ['_id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_FAVORITE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<FavoriteTypeormEntity>(db, {
        table: 'capital_favorites',
        primaryKey: ['_id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_GITHUB_BRANCH_COMMIT_SYNC_STATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubBranchCommitSyncStateTypeormEntity>(db, {
        table: 'capital_github_branch_commit_sync_state',
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_GITHUB_COMM_MESSAGE_CURSOR_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubCommMessageCursorTypeormEntity>(db, {
        table: 'capital_github_comm_message_cursor',
        primaryKey: ['id'],
        numbers: ['lastOriginServerTs'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: CAPITAL_GITHUB_COMM_TRANSCRIPTION_CURSOR_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GithubCommTranscriptionCursorTypeormEntity>(db, {
        table: 'capital_github_comm_transcription_cursor',
        primaryKey: ['id'],
        updatedAt: 'updatedAt',
      }),
  },
  {
    provide: CAPITAL_GITHUB_FILE_INDEX_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<GitHubFileIndexTypeormEntity>(db, {
        table: 'capital_github_file_indexes',
        primaryKey: ['id'],
        updatedAt: 'last_synced_at',
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_ISSUE_LINKED_GIT_COMMIT_SHA_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueLinkedGitCommitShaTypeormEntity>(db, {
        table: 'capital_issue_linked_git_commit_shas',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_ISSUE_LINKED_GIT_COMMIT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueLinkedGitCommitTypeormEntity>(db, {
        table: 'capital_issue_linked_git_commits',
        primaryKey: ['id'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_PROCESS_INSTANCE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProcessInstanceTypeormEntity>(db, {
        table: 'capital_process_instances',
        primaryKey: ['id'],
        json: ['step_states'],
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_PROCESS_TEMPLATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProcessTemplateTypeormEntity>(db, {
        table: 'capital_process_templates',
        primaryKey: ['id'],
        json: ['steps', 'edges'],
        updatedAt: 'updated_at',
        sameNames: true,
      }),
  },
  {
    provide: CAPITAL_APPENDIX_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<AppendixTypeormEntity>(db, {
        table: 'capital_appendixes',
        primaryKey: ['_id'],
        json: ['appendix'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'project_hash', 'appendix_hash', 'blockchain_status', 'created_at', 'appendix', 'contribution'],
      }),
  },
  {
    provide: CAPITAL_COMMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<CommentTypeormEntity>(db, {
        table: 'capital_comments',
        primaryKey: ['_id'],
        json: ['reactions'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'content', 'commentor_id', 'issue_id', 'reactions', 'edited_at'],
      }),
  },
  {
    provide: CAPITAL_COMMIT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<CommitTypeormEntity>(db, {
        table: 'capital_commits',
        primaryKey: ['_id'],
        json: ['amounts', 'data'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'project_hash', 'commit_hash', 'amounts', 'description', 'meta', 'data', 'blockchain_status', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_COMPONENT_METRIC_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ComponentMetricTypeormEntity>(db, {
        table: 'capital_component_metrics',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'metric_hash', 'measure_hash', 'coopname', 'project_hash', 'target_value', 'deadline', 'created_by'],
      }),
  },
  {
    provide: CAPITAL_CONTRIBUTOR_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ContributorTypeormEntity>(db, {
        table: 'capital_contributors',
        primaryKey: ['_id'],
        json: ['contract', 'appendixes'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'contributor_hash', 'blockchain_status', 'memo', 'is_external_contract', 'contract', 'appendixes', 'rate_per_hour', 'hours_per_day', 'debt_amount', 'reward_per_share_last', 'contributed_as_investor', 'contributed_as_creator', 'contributed_as_author', 'contributed_as_coordinator', 'contributed_as_contributor', 'contributed_as_propertor', 'created_at', 'level', 'energy', 'last_energy_update', 'display_name', 'about', 'program_key', 'blagorost_offer_hash', 'generator_offer_hash', 'generation_contract_hash', 'storage_agreement_hash', 'blagorost_agreement_hash', 'is_external_blagorost_agreement'],
      }),
  },
  {
    provide: CAPITAL_CYCLE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<CycleTypeormEntity>(db, {
        table: 'capital_cycles',
        primaryKey: ['_id'],
        dates: ['start_date', 'end_date'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'name', 'start_date', 'end_date'],
      }),
  },
  {
    provide: CAPITAL_DEBT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<DebtTypeormEntity>(db, {
        table: 'capital_debts',
        primaryKey: ['_id'],
        json: ['statement', 'approved_statement', 'authorization'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'debt_hash', 'project_hash', 'blockchain_status', 'repaid_at', 'amount', 'statement', 'approved_statement', 'authorization', 'memo', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_EXPENSE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ExpenseTypeormEntity>(db, {
        table: 'capital_expenses',
        primaryKey: ['_id'],
        json: ['expense_statement', 'approved_statement', 'authorization'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'project_hash', 'expense_hash', 'fund_id', 'blockchain_status', 'amount', 'description', 'expense_statement', 'approved_statement', 'authorization', 'spended_at', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_INVEST_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<InvestTypeormEntity>(db, {
        table: 'capital_invests',
        primaryKey: ['_id'],
        json: ['statement'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'invest_hash', 'project_hash', 'blockchain_status', 'amount', 'invested_at', 'statement', 'coordinator', 'coordinator_amount', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_ISSUE_METRIC_BINDING_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueMetricBindingTypeormEntity>(db, {
        table: 'capital_issue_metric_bindings',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'issue_hash', 'metric_hash', 'delta'],
      }),
  },
  {
    provide: CAPITAL_ISSUE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<IssueTypeormEntity>(db, {
        table: 'capital_issues',
        primaryKey: ['_id'],
        json: ['metadata'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'issue_hash', 'coopname', 'title', 'description', 'priority', 'estimate', 'sort_order', 'content_rev', 'created_by', 'creators', 'submaster', 'project_hash', 'cycle_id', 'metadata'],
      }),
  },
  {
    provide: CAPITAL_MEASURE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MeasureTypeormEntity>(db, {
        table: 'capital_measures',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'measure_hash', 'coopname', 'title', 'unit', 'series_mode', 'created_by'],
      }),
  },
  {
    provide: CAPITAL_METRIC_CONTRIBUTION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<MetricContributionTypeormEntity>(db, {
        table: 'capital_metric_contributions',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'contribution_hash', 'metric_hash', 'issue_hash', 'delta', 'source', 'username', 'occurred_at'],
      }),
  },
  {
    provide: CAPITAL_PROGRAM_PROPERTY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProgramPropertyTypeormEntity>(db, {
        table: 'capital_program_properties',
        primaryKey: ['_id'],
        json: ['statement', 'authorization', 'act'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'blockchain_status', 'property_hash', 'property_amount', 'property_description', 'statement', 'authorization', 'act', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_PROGRAM_WALLET_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProgramWalletTypeormEntity>(db, {
        table: 'capital_program_wallets',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'last_program_crps', 'capital_available'],
      }),
  },
  {
    provide: CAPITAL_PROGRAM_WITHDRAW_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProgramWithdrawTypeormEntity>(db, {
        table: 'capital_program_withdraws',
        primaryKey: ['_id'],
        json: ['statement'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'withdraw_hash', 'username', 'blockchain_status', 'amount', 'statement', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_PROJECT_PROPERTY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProjectPropertyTypeormEntity>(db, {
        table: 'capital_project_properties',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'username', 'blockchain_status', 'project_hash', 'property_hash', 'property_amount', 'property_description', 'created_at'],
      }),
  },
  {
    provide: CAPITAL_PROJECT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ProjectTypeormEntity>(db, {
        table: 'capital_projects',
        primaryKey: ['_id'],
        json: ['authorization', 'counts', 'plan', 'fact', 'crps', 'voting', 'matrix_component_announcement_events'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'project_hash', 'parent_hash', 'blockchain_status', 'is_opened', 'is_planed', 'is_authorized', 'master', 'title', 'description', 'invite', 'data', 'meta', 'authorization', 'counts', 'plan', 'fact', 'crps', 'voting', 'created_at', 'priority', 'content_rev', 'prefix', 'issue_counter', 'voting_deadline', 'matrix_room_id', 'matrix_component_announcement_events', 'development_repository_url', 'origin', 'local_owner'],
      }),
  },
  {
    provide: CAPITAL_RESULT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<ResultTypeormEntity>(db, {
        table: 'capital_results',
        primaryKey: ['_id'],
        json: ['statement', 'authorization', 'act'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'project_hash', 'result_hash', 'coopname', 'username', 'blockchain_status', 'created_at', 'debt_amount', 'total_amount', 'statement', 'authorization', 'act', 'data'],
      }),
  },
  {
    provide: CAPITAL_SEGMENT_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<SegmentTypeormEntity>(db, {
        table: 'capital_segments',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'project_hash', 'coopname', 'username', 'is_author', 'is_creator', 'is_coordinator', 'is_investor', 'is_propertor', 'is_contributor', 'has_vote', 'investor_amount', 'investor_base', 'creator_base', 'creator_bonus', 'author_base', 'author_bonus', 'coordinator_investments', 'coordinator_base', 'contributor_bonus', 'property_base', 'last_author_base_reward_per_share', 'last_author_bonus_reward_per_share', 'last_contributor_reward_per_share', 'capital_contributor_shares', 'last_known_invest_pool', 'last_known_creators_base_pool', 'last_known_coordinators_investment_pool', 'provisional_amount', 'debt_amount', 'debt_settled', 'equal_author_bonus', 'direct_creator_bonus', 'voting_bonus', 'is_votes_calculated', 'total_segment_base_cost', 'total_segment_bonus_cost', 'total_segment_cost', 'intellectual_cost', 'share_percent', 'is_completed', 'available_for_program', 'available_for_wallet'],
      }),
  },
  {
    provide: CAPITAL_STATE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<StateTypeormEntity>(db, {
        table: 'capital_state',
        primaryKey: ['_id'],
        json: ['config'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'global_available_invest_pool', 'program_membership_funded', 'program_membership_available', 'program_membership_distributed', 'program_membership_cumulative_reward_per_share', 'config'],
      }),
  },
  {
    provide: CAPITAL_STORY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<StoryTypeormEntity>(db, {
        table: 'capital_stories',
        primaryKey: ['_id'],
        json: ['matrix_requirement_announcement_events'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'story_hash', 'coopname', 'title', 'description', 'content_format', 'project_hash', 'issue_hash', 'created_by', 'sort_order', 'content_rev', 'matrix_requirement_announcement_events'],
      }),
  },
  {
    provide: CAPITAL_TIME_ENTRY_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<TimeEntryEntity>(db, {
        table: 'capital_time_entries',
        primaryKey: ['_id'],
        dates: ['date'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'contributor_hash', 'issue_hash', 'project_hash', 'coopname', 'date', 'hours', 'commit_hash', 'is_committed', 'entry_type', 'estimate_snapshot'],
      }),
  },
  {
    provide: CAPITAL_TIMER_SESSION_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<TimerSessionEntity>(db, {
        table: 'capital_timer_sessions',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'contributor_hash', 'issue_hash', 'project_hash', 'coopname', 'started_at', 'stopped_at', 'paused_at', 'total_paused_ms'],
      }),
  },
  {
    provide: CAPITAL_VOTE_STORE,
    inject: [KYSELY],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFactory: (db: Kysely<any>) =>
      new TableStore<VoteTypeormEntity>(db, {
        table: 'capital_votes',
        primaryKey: ['_id'],
        updatedAt: '_updated_at',
        sameNames: true,
        columns: ['_id', 'block_num', 'present', 'status', '_created_at', '_updated_at', 'id', 'coopname', 'project_hash', 'voter', 'recipient', 'amount', 'voted_at'],
      }),
  },
];
