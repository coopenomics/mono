import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { ContributorTypeormEntity } from '../entities/contributor.typeorm-entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import { ProgramPropertyTypeormEntity } from '../entities/program-property.typeorm-entity';
import { ProgramWithdrawTypeormEntity } from '../entities/program-withdraw.typeorm-entity';
import { ProjectPropertyTypeormEntity } from '../entities/project-property.typeorm-entity';
import { ProgramWalletTypeormEntity } from '../entities/program-wallet.typeorm-entity';
import { CycleTypeormEntity } from '../entities/cycle.typeorm-entity';
import { IssueTypeormEntity } from '../entities/issue.typeorm-entity';
import { CommentTypeormEntity } from '../entities/comment.typeorm-entity';
import { StoryTypeormEntity } from '../entities/story.typeorm-entity';
import { VoteTypeormEntity } from '../entities/vote.typeorm-entity';
import { DebtTypeormEntity } from '../entities/debt.typeorm-entity';
import { ResultTypeormEntity } from '../entities/result.typeorm-entity';
import { ExpenseTypeormEntity } from '../entities/expense.typeorm-entity';
import { FavoriteTypeormEntity } from '../entities/favorite.typeorm-entity';
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import { StateTypeormEntity } from '../entities/state.typeorm-entity';
import { TimeEntryEntity } from '../entities/time-entry.entity';
import { TimerSessionEntity } from '../entities/timer-session.entity';
import { SegmentTypeormEntity } from '../entities/segment.typeorm-entity';
import { ProcessTemplateTypeormEntity } from '../entities/process-template.entity';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import { GitHubFileIndexTypeormEntity } from '../entities/github-file-index.typeorm-entity';
import { GithubBranchCommitSyncStateTypeormEntity } from '../entities/github-branch-commit-sync-state.typeorm-entity';
import { IssueLinkedGitCommitTypeormEntity } from '../entities/issue-linked-git-commit.typeorm-entity';
import { IssueLinkedGitCommitShaTypeormEntity } from '../entities/issue-linked-git-commit-sha.typeorm-entity';
import { GithubCommMessageCursorTypeormEntity } from '../entities/github-comm-message-cursor.typeorm-entity';
import { GithubCommTranscriptionCursorTypeormEntity } from '../entities/github-comm-transcription-cursor.typeorm-entity';
import { ComponentMetricTypeormEntity } from '../entities/component-metric.typeorm-entity';
import { MeasureTypeormEntity } from '../entities/measure.typeorm-entity';
import { IssueMetricBindingTypeormEntity } from '../entities/issue-metric-binding.typeorm-entity';
import { MetricContributionTypeormEntity } from '../entities/metric-contribution.typeorm-entity';
import { EntityVersionTypeormEntity } from '@coopenomics/extension-kit/sync';

// Константа для имени подключения к базе данных capital (сохранена для обратной совместимости импортов, но не используется)
export const CAPITAL_DATABASE_CONNECTION = undefined as any;

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectTypeormEntity,
      ContributorTypeormEntity,
      AppendixTypeormEntity,
      InvestTypeormEntity,
      ProgramPropertyTypeormEntity,
      ProgramWithdrawTypeormEntity,
      ProjectPropertyTypeormEntity,
      ProgramWalletTypeormEntity,
      CycleTypeormEntity,
      IssueTypeormEntity,
      CommentTypeormEntity,
      StoryTypeormEntity,
      VoteTypeormEntity,
      DebtTypeormEntity,
      ResultTypeormEntity,
      ExpenseTypeormEntity,
      FavoriteTypeormEntity,
      CommitTypeormEntity,
      StateTypeormEntity,
      TimeEntryEntity,
      TimerSessionEntity,
      SegmentTypeormEntity,
      GitHubFileIndexTypeormEntity,
      GithubCommMessageCursorTypeormEntity,
      GithubCommTranscriptionCursorTypeormEntity,
      EntityVersionTypeormEntity,
      ProcessTemplateTypeormEntity,
      ProcessInstanceTypeormEntity,
      GithubBranchCommitSyncStateTypeormEntity,
      IssueLinkedGitCommitTypeormEntity,
      IssueLinkedGitCommitShaTypeormEntity,
      ComponentMetricTypeormEntity,
      MeasureTypeormEntity,
      IssueMetricBindingTypeormEntity,
      MetricContributionTypeormEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class CapitalDatabaseModule {}
