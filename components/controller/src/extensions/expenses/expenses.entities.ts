/**
 * Сущности расширения «Шасси расходов»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { ExpenseProposalTypeormEntity } from './infrastructure/entities/expense-proposal.typeorm-entity';

// Реестр файлов, снимки реквизитов и планы расходов переведены на Kysely
// (C28-81) — их таблицы объявлены шлюзами в `infrastructure/database/expenses-stores.ts`.
export const expensesEntities = [
  ExpenseProposalTypeormEntity,
];
