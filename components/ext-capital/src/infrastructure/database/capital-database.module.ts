import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTypeormEntity } from '../entities/project.typeorm-entity';
import { ContributorTypeormEntity } from '../entities/contributor.typeorm-entity';
import { AppendixTypeormEntity } from '../entities/appendix.typeorm-entity';
import { InvestTypeormEntity } from '../entities/invest.typeorm-entity';
import { ProgramInvestTypeormEntity } from '../entities/program-invest.typeorm-entity';
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
import { CommitTypeormEntity } from '../entities/commit.typeorm-entity';
import { StateTypeormEntity } from '../entities/state.typeorm-entity';
import { TimeEntryEntity } from '../entities/time-entry.entity';
import { SegmentTypeormEntity } from '../entities/segment.typeorm-entity';
import { ProcessTemplateTypeormEntity } from '../entities/process-template.entity';
import { ProcessInstanceTypeormEntity } from '../entities/process-instance.entity';
import { GitHubFileIndexTypeormEntity } from '../entities/github-file-index.typeorm-entity';
import { config } from '~/config';
import { EntityVersionTypeormEntity } from '~/shared/sync/entities/entity-version.typeorm-entity';

// Константа для имени подключения к базе данных capital
export const CAPITAL_DATABASE_CONNECTION = 'capital';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: CAPITAL_DATABASE_CONNECTION, // Отдельное подключение для capital
      useFactory: () => ({
        type: 'postgres',
        host: config.postgres.host,
        port: Number(config.postgres.port),
        username: config.postgres.username,
        password: config.postgres.password,
        database: config.postgres.database,

        entities: [
          ProjectTypeormEntity,
          ContributorTypeormEntity,
          AppendixTypeormEntity,
          InvestTypeormEntity,
          ProgramInvestTypeormEntity,
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
          CommitTypeormEntity,
          StateTypeormEntity,
          TimeEntryEntity,
          SegmentTypeormEntity,
          GitHubFileIndexTypeormEntity,
          EntityVersionTypeormEntity,
          ProcessTemplateTypeormEntity,
          ProcessInstanceTypeormEntity,
        ],
        //        synchronize: config.env === 'development', // Используем миграции для production
        synchronize: true, // Временно всегда синхронизируем
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature(
      [
        ProjectTypeormEntity,
        ContributorTypeormEntity,
        AppendixTypeormEntity,
        InvestTypeormEntity,
        ProgramInvestTypeormEntity,
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
        CommitTypeormEntity,
        StateTypeormEntity,
        TimeEntryEntity,
        SegmentTypeormEntity,
        GitHubFileIndexTypeormEntity,
        EntityVersionTypeormEntity,
        ProcessTemplateTypeormEntity,
        ProcessInstanceTypeormEntity,
      ],
      CAPITAL_DATABASE_CONNECTION
    ), // Указываем connection name
  ],
  exports: [TypeOrmModule],
})
export class CapitalDatabaseModule {}
