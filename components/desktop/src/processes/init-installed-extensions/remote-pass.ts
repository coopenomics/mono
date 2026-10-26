import type { Router } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { installRemoteExtensions } from './remote-loader';

// Модуль без зависимости от реестра расширений: его импортируют виджеты
// страниц приложений, а реестр импортирует эти страницы (см. index.ts).

/**
 * Проход по приложениям каталога: столы установленных и включённых пакетов
 * встают в меню, столы выключенных и отменённых снимаются. Сервер о столах
 * пакетов не знает, поэтому стол регистрирует их сам (26.10.2026). Проход
 * идемпотентен: его зовут при загрузке, по таймеру и сразу после подписки
 * или переключения приложения — чтобы стол появлялся без ожидания.
 */
export async function runRemotePass(router: Router): Promise<void> {
  const store = useDesktopStore();
  try {
    const coopname = (store as any).currentCoopname ?? '';
    const packages = await installRemoteExtensions(coopname, router);
    const names = new Set<string>();
    for (const pkg of packages) {
      for (const config of pkg.configs) {
        if (!config?.routes?.length) continue;
        // install.js пакета может назвать стол либо `workspace`, либо только
        // `extension_name` — берём первое, что есть, иначе имя пакета.
        const name = String(config.workspace || config.extension_name || pkg.packageId);
        names.add(name);
        store.ensureRemoteWorkspace({
          name,
          title: String(config.title || name),
          extension_name: pkg.packageId,
          icon: (config as { icon?: string }).icon,
          defaultRoute: config.defaultRoute,
          routes: config.routes as any,
        });
        const baseRoute = router.getRoutes().find((r) => r.name === 'base');
        if (baseRoute) {
          config.routes.forEach((r: any) => {
            const existing = router.getRoutes().find((x) => x.name === r.name);
            if (!existing) {
              router.addRoute('base', r);
            }
          });
        }
      }
    }
    store.keepRemoteWorkspaces(names);
  } catch (err) {
    console.error('[init-installed-extensions] remote pass failed:', err);
  }
}
