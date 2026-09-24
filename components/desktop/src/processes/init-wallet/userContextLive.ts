import { SovietContract } from 'cooptypes';
import { registerLiveReload, liveTable } from 'src/shared/lib/realtime';
import { loadUserContext } from './loadUserContext';

let registered = false;

/**
 * Учётная запись пайщика (роль, статус участника, кандидатство) живёт по
 * ленте изменений: принятие советом, блокировка, выход и смена роли видны
 * сразу — доступы кабинета и профиль перестраиваются без перезагрузки.
 * Строки личные: сигнал приходит самому пайщику (и совету).
 */
export function registerUserContextLive(): void {
  if (registered) return;
  registered = true;
  registerLiveReload(
    [
      liveTable(SovietContract, SovietContract.Tables.Participants),
      { code: 'core', table: 'users' },
      { code: 'core', table: 'candidates' },
    ],
    () => loadUserContext(),
  );
}
