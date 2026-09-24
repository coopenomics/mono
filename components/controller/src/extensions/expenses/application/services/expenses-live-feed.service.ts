import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { EntityName as ExpenseProposalsTable } from '../../infrastructure/entities/expense-proposal.typeorm-entity';
import { EntityName as ExpenseFilesTable } from '../../infrastructure/entities/expense-file.typeorm-entity';

/**
 * Таблицы расходов в ленте изменений: реестр служебных записок на столе совета
 * и столах участка перечитывается сам, когда предложение создано, утверждено,
 * оплачено или к нему приложен файл. Расширение без записи в реестре и без
 * `initialize()`, поэтому объявление — при старте модуля.
 */
@Injectable()
export class ExpensesLiveFeedService implements OnModuleInit {
  constructor(@Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null) {}

  onModuleInit(): void {
    this.chainChanges?.declareLocalTables([
      // Служебная записка — её автору и совету.
      { code: 'expenses', table: ExpenseProposalsTable, owner_field: 'username' },
      { code: 'expenses', table: ExpenseFilesTable, owner_field: 'uploaded_by_username' },
    ]);
  }
}
