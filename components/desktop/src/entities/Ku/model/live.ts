import { BranchContract, SovietContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

const T = BranchContract.Tables;

/**
 * Таблицы кооперативного участка в ленте изменений: участки, их собрания
 * (решения и вопросы), веса голосов, помощь и траты, заявки на доверенность,
 * а также прикрепление пайщиков к участку (soviet::participants). Экраны
 * участков перечитываются по любому их изменению.
 */
export const KU_LIVE_TABLES: ChainTableRef[] = [
  ...[T.Branches, T.Decisions, T.DecisionQuestions, T.Weights, T.WeightTotals, T.Aids, T.Spends, T.TrustReqs].map(
    (table) => liveTable(BranchContract, table),
  ),
  liveTable(SovietContract, SovietContract.Tables.Participants),
];
