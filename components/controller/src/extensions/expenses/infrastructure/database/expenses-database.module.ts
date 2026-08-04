import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseProposalTypeormEntity } from '../entities/expense-proposal.typeorm-entity';
import { ExpenseFileTypeormEntity } from '../entities/expense-file.typeorm-entity';
import { ExpenseRequisiteSnapshotTypeormEntity } from '../entities/expense-requisite-snapshot.typeorm-entity';
import { EntityVersionTypeormEntity } from '~/shared/sync/entities/entity-version.typeorm-entity';

/**
 * TypeORM-модуль расширения `expense` — зеркало SP-расходов + реестр файлов
 * + снимки реквизитов получателей.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseProposalTypeormEntity,
      ExpenseFileTypeormEntity,
      ExpenseRequisiteSnapshotTypeormEntity,
      EntityVersionTypeormEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class ExpensesDatabaseModule {}
