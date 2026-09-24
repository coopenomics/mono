import type { Router } from 'vue-router';
import { BranchContract, SovietContract, WalletContract } from 'cooptypes';
import { liveTable, registerLiveReload } from 'src/shared/lib/realtime';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { useInitExtensionsProcess } from './index';

let registered = false;

/**
 * Рабочий стол пайщика (столы, меню, гранты) живёт по ленте изменений.
 * Состав столов меняют установка и подключение расширений, гранты — роль
 * пайщика, его статус в кооперативе, подписанные соглашения и участие в
 * программах, а у Стола заказов — ещё корзина с пунктом выдачи, реестр
 * поставщиков и председатели участков. Без этого новый стол или снятое право
 * появлялись только после перезагрузки страницы.
 */
export function registerDesktopLive(router: Router): void {
  if (registered) return;
  registered = true;
  registerLiveReload(
    [
      { code: 'core', table: 'extensions' },
      { code: 'core', table: 'users' },
      liveTable(SovietContract, SovietContract.Tables.Participants),
      liveTable(SovietContract, SovietContract.Tables.Agreements),
      liveTable(WalletContract, WalletContract.Tables.Users),
      liveTable(BranchContract, BranchContract.Tables.Branches),
      { code: 'market', table: 'marketplace_cart' },
      { code: 'market', table: 'marketplace_supplier' },
    ],
    () => reloadDesktop(router),
  );
}

/**
 * Перечитать стол; стол, появившийся после подключения расширения, ещё без
 * маршрутов — их даёт установка расширений (повторный вызов безопасен: уже
 * зарегистрированные маршруты пропускаются).
 */
async function reloadDesktop(router: Router): Promise<void> {
  if (!useSessionStore().isAuth) return;
  const desktop = useDesktopStore();
  const before = new Set(desktop.currentDesktop?.workspaces.map((ws) => ws.name) ?? []);
  await desktop.loadDesktop();
  const appeared = desktop.currentDesktop?.workspaces.some((ws) => !before.has(ws.name));
  if (appeared) await useInitExtensionsProcess(router);
}
