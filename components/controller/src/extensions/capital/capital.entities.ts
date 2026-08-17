/**
 * Сущности расширения «Капитал»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { AppendixTypeormEntity } from './infrastructure/entities/appendix.typeorm-entity';
import { CommentTypeormEntity } from './infrastructure/entities/comment.typeorm-entity';
import { CommitTypeormEntity } from './infrastructure/entities/commit.typeorm-entity';
import { ComponentMetricTypeormEntity } from './infrastructure/entities/component-metric.typeorm-entity';
import { ContributorTypeormEntity } from './infrastructure/entities/contributor.typeorm-entity';
import { CycleTypeormEntity } from './infrastructure/entities/cycle.typeorm-entity';
import { DebtTypeormEntity } from './infrastructure/entities/debt.typeorm-entity';
import { ExpenseTypeormEntity } from './infrastructure/entities/expense.typeorm-entity';
import { GithubBranchCommitSyncStateTypeormEntity } from './infrastructure/entities/github-branch-commit-sync-state.typeorm-entity';
import { GithubCommMessageCursorTypeormEntity } from './infrastructure/entities/github-comm-message-cursor.typeorm-entity';
import { GithubCommTranscriptionCursorTypeormEntity } from './infrastructure/entities/github-comm-transcription-cursor.typeorm-entity';
import { GitHubFileIndexTypeormEntity } from './infrastructure/entities/github-file-index.typeorm-entity';
import { InvestTypeormEntity } from './infrastructure/entities/invest.typeorm-entity';
import { IssueLinkedGitCommitTypeormEntity } from './infrastructure/entities/issue-linked-git-commit.typeorm-entity';
import { IssueMetricBindingTypeormEntity } from './infrastructure/entities/issue-metric-binding.typeorm-entity';
import { IssueTypeormEntity } from './infrastructure/entities/issue.typeorm-entity';
import { MeasureTypeormEntity } from './infrastructure/entities/measure.typeorm-entity';
import { MetricContributionTypeormEntity } from './infrastructure/entities/metric-contribution.typeorm-entity';
import { ProcessInstanceTypeormEntity } from './infrastructure/entities/process-instance.entity';
import { ProcessTemplateTypeormEntity } from './infrastructure/entities/process-template.entity';
import { ProgramPropertyTypeormEntity } from './infrastructure/entities/program-property.typeorm-entity';
import { ProgramWalletTypeormEntity } from './infrastructure/entities/program-wallet.typeorm-entity';
import { ProgramWithdrawTypeormEntity } from './infrastructure/entities/program-withdraw.typeorm-entity';
import { ProjectPropertyTypeormEntity } from './infrastructure/entities/project-property.typeorm-entity';
import { ProjectTypeormEntity } from './infrastructure/entities/project.typeorm-entity';
import { ResultTypeormEntity } from './infrastructure/entities/result.typeorm-entity';
import { SegmentTypeormEntity } from './infrastructure/entities/segment.typeorm-entity';
import { StateTypeormEntity } from './infrastructure/entities/state.typeorm-entity';
import { StoryTypeormEntity } from './infrastructure/entities/story.typeorm-entity';
import { TimeEntryEntity } from './infrastructure/entities/time-entry.entity';
import { TimerSessionEntity } from './infrastructure/entities/timer-session.entity';
import { VoteTypeormEntity } from './infrastructure/entities/vote.typeorm-entity';

export const capitalEntities = [
  AppendixTypeormEntity,
  CommentTypeormEntity,
  CommitTypeormEntity,
  ComponentMetricTypeormEntity,
  ContributorTypeormEntity,
  CycleTypeormEntity,
  DebtTypeormEntity,
  ExpenseTypeormEntity,
  GithubBranchCommitSyncStateTypeormEntity,
  GithubCommMessageCursorTypeormEntity,
  GithubCommTranscriptionCursorTypeormEntity,
  GitHubFileIndexTypeormEntity,
  InvestTypeormEntity,
  IssueLinkedGitCommitTypeormEntity,
  IssueMetricBindingTypeormEntity,
  IssueTypeormEntity,
  MeasureTypeormEntity,
  MetricContributionTypeormEntity,
  ProcessInstanceTypeormEntity,
  ProcessTemplateTypeormEntity,
  ProgramPropertyTypeormEntity,
  ProgramWalletTypeormEntity,
  ProgramWithdrawTypeormEntity,
  ProjectPropertyTypeormEntity,
  ProjectTypeormEntity,
  ResultTypeormEntity,
  SegmentTypeormEntity,
  StateTypeormEntity,
  StoryTypeormEntity,
  TimeEntryEntity,
  TimerSessionEntity,
  VoteTypeormEntity,
];
