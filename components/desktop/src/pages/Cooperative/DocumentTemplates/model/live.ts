import { DraftContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

/**
 * Откуда собирается реестр шаблонов: редакции платформы (реестр draft),
 * утверждения совета кооператива и вопросы повестки об утверждении
 * (правила отслеживания узла). Реестр и счётчик на вкладке перечитываются,
 * когда меняется любая из них.
 */
export const DOCUMENT_TEMPLATES_LIVE_TABLES: ChainTableRef[] = [
  liveTable(DraftContract, DraftContract.Tables.Drafts),
  liveTable(DraftContract, DraftContract.Tables.Approvals),
  { code: 'core', table: 'tracking_rules' },
];
