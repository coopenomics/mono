import { CapitalContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

const T = CapitalContract.Tables;

/**
 * Таблицы Благороста в ленте изменений (объявлены расширением на сервере):
 * данные цепи — проекты, сегменты, голоса, результаты, коммиты, взносы и
 * кошельки программы — и оффчейн-работа в базе узла — задачи, истории,
 * обсуждения, учёт времени, метрики. Экраны Благороста перечитываются по
 * любому изменению в программе: так надёжнее, чем угадывать источник каждого
 * поля, а соседние сигналы одного блока сливаются в одно перечитывание.
 */
export const CAPITAL_LIVE_TABLES: ChainTableRef[] = [
  ...[
    T.Contributors,
    T.Projects,
    T.ProjectProperties,
    T.ProgramProperties,
    T.Segments,
    T.Votes,
    T.Results,
    T.Commits,
    T.Appendixes,
    T.State,
    T.Invests,
    T.ProgramInvests,
    T.Debts,
    T.ProgramWithdraws,
    T.ProgramWallets,
    T.Expenses,
    T.ProgramExpenses,
  ].map((table) => liveTable(CapitalContract, table)),
  ...[
    'capital_issues',
    'capital_stories',
    'capital_comments',
    'capital_cycles',
    'capital_time_entries',
    'capital_timer_sessions',
    'capital_component_metrics',
    'capital_measures',
    'capital_metric_contributions',
    'capital_issue_metric_bindings',
    'capital_issue_linked_git_commits',
    'capital_favorites',
  ].map((table) => ({ code: CapitalContract.contractName.production, table })),
];
