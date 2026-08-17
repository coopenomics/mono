/**
 * Сущности расширения «Шасси расходов»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { ExpenseFileTypeormEntity } from './infrastructure/entities/expense-file.typeorm-entity';
import { ExpensePlanEntity } from './infrastructure/entities/expense-plan.entity';
import { ExpenseProposalTypeormEntity } from './infrastructure/entities/expense-proposal.typeorm-entity';
import { ExpenseRequisiteSnapshotTypeormEntity } from './infrastructure/entities/expense-requisite-snapshot.typeorm-entity';

export const expensesEntities = [
  ExpenseFileTypeormEntity,
  ExpensePlanEntity,
  ExpenseProposalTypeormEntity,
  ExpenseRequisiteSnapshotTypeormEntity,
];
