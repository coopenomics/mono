import { SovietContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

/**
 * Таблицы, от которых зависят данные пайщика: вступление, регистрационный
 * взнос, блокировка, выход, сверка личности и правка анкеты. Личные данные
 * (ФИО, реквизиты) живут в генераторе, сигнал по ним шлёт его сервис.
 */
export const PARTICIPANT_LIVE_TABLES: ChainTableRef[] = [
  liveTable(SovietContract, SovietContract.Tables.Participants),
  { code: 'core', table: 'users' },
  { code: 'core', table: 'candidates' },
  { code: 'core', table: 'payments' },
  { code: 'core', table: 'verification_reviews' },
  { code: 'core', table: 'private_accounts' },
];
