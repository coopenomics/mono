import { MeetContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

/**
 * Откуда собирается собрание: созыв, вопросы и голоса — таблицы meet в цепи,
 * собрание до созыва и итог обработки закрытого — таблицы узла. Экраны
 * собраний перечитываются, когда меняется любая из них.
 */
export const MEET_LIVE_TABLES: ChainTableRef[] = [
  liveTable(MeetContract, MeetContract.Tables.Meets),
  liveTable(MeetContract, MeetContract.Tables.Questions),
  { code: 'core', table: 'meet_pre' },
  { code: 'core', table: 'meet_processed' },
];
