import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort } from '@coopenomics/innercoop';
import { SovietContract } from 'cooptypes';

/** Код расширения «Стол бухгалтера» в ленте изменений. */
const CODE = 'reports';

/**
 * Таблицы стола бухгалтера в ленте изменений. Стол открыт только
 * председателю, поэтому все таблицы служебные. Сформированные отчёты,
 * черновики, отметки о сдаче, реквизиты и корректировки остатков — в базе
 * узла; заявки на перечисление удержанного НДФЛ — в цепи (soviet::taxes).
 * Учёт (счета, операции, проводки, кошельки) стол читает по таблицам ledger2
 * ленты ядра. Объявление — при старте модуля: `initialize()` у расширения
 * пустой и зовётся только после установки.
 */
@Injectable()
export class ReportsLiveFeedService implements OnModuleInit {
  constructor(@Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null) {}

  onModuleInit(): void {
    this.chainChanges?.declareLocalTables(
      ['generated_reports', 'report_drafts', 'report_submission_marks', 'report_requisites', 'balance_corrections'].map(
        (table) => ({ code: CODE, table, staff_only: true })
      )
    );
    this.chainChanges?.declareTables([
      {
        code: SovietContract.contractName.production,
        table: SovietContract.Tables.Taxes.tableName,
        staff_only: true,
      },
    ]);
  }
}
