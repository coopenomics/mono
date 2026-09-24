import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { EntityName as ExpenseProposalsTable } from '../../infrastructure/entities/expense-proposal.typeorm-entity';
import { EntityName as ExpenseFilesTable } from '../../infrastructure/entities/expense-file.typeorm-entity';

/** Имя таблицы плановых расходов (`ExpensePlanEntity`). */
const EXPENSE_PLANS_TABLE = 'expense_plans';

/**
 * Таблицы расходов в ленте изменений: реестр служебных записок на столе совета
 * и столах участка перечитывается сам, когда предложение создано, утверждено,
 * оплачено или к нему приложен файл; плановые расходы — когда план заведён,
 * изменён или оплачен. Расширение без записи в реестре и без
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
      // Плановые расходы открыты пайщикам (резерв средств участка и кооператива).
      { code: 'expenses', table: EXPENSE_PLANS_TABLE },
    ]);
  }
}
