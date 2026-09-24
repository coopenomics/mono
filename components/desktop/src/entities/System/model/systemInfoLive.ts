import { RegistratorContract, SovietContract } from 'cooptypes';
import { registerLiveReload, liveTable } from 'src/shared/lib/realtime';
import { useSystemStore } from './store';

// Модуль, как и подписка ленты, не входит в бочку `model`: регистрируется
// один раз ядром приложения.

let registered = false;

/**
 * Сведения о кооперативе живут по ленте изменений: состав совета, карточка в
 * реестре сети (реквизиты, взносы при вступлении, контакты), настройки и
 * статус системы обновляются на всех столах сразу, а не на следующем тике
 * проверки доступности (30 с).
 */
export function registerSystemInfoLive(): void {
  if (registered) return;
  registered = true;
  registerLiveReload(
    [
      liveTable(SovietContract, SovietContract.Tables.Boards),
      liveTable(RegistratorContract, RegistratorContract.Tables.Cooperatives),
      { code: 'core', table: 'settings' },
      { code: 'core', table: 'system_status' },
    ],
    () => useSystemStore().loadSystemInfo(),
  );
}
