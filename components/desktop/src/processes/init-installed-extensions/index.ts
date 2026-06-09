import type { Router } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { extensionsRegistry, getAvailableExtensions } from './extensions-registry';
import { installRemoteExtensions } from './remote-loader';

export async function useInitExtensionsProcess(router: Router) {
  const store = useDesktopStore();

  // Получаем список всех доступных расширений
  const availableExtensions = getAvailableExtensions();

  // Загружаем все расширения из регистра
  for (const extensionName of availableExtensions) {
    try {

      const installFunction = extensionsRegistry[extensionName];
      const result = await installFunction();

      // Поддержка обоих форматов: массив или одиночный объект (для обратной совместимости)
      const workspaceConfigs: IWorkspaceConfig[] = Array.isArray(result) ? result : [result];
      // Обрабатываем каждый workspace из расширения
      for (const config of workspaceConfigs) {
        if (config?.workspace && config?.routes?.length) {

          // Записываем маршруты в соответствующий workspace
          store.setRoutes(config.workspace, config.routes as any);

          // Регистрируем маршруты в router, добавляя их в базовый родительский маршрут
          const baseRoute = router.getRoutes().find((r) => r.name === 'base');
          if (baseRoute) {
            config.routes.forEach((r: any) => {
              // Проверяем, не зарегистрирован ли уже маршрут
              const existingRoute = router.getRoutes().find((route) => route.name === r.name);
              if (!existingRoute) {
                router.addRoute('base', r);
              } else {
              }
            });
          }
        }
      }
    } catch {
      // Продолжаем загрузку других расширений даже если одно не загрузилось
    }
  }

  // Epic 9 story 9.4 — remote-loader pass. Тянем пакеты с активной
  // подпиской из apps-catalog. На V1 — заглушка, возвращает [];
  // реальный fetch + eval — 9.4.b.
  try {
    const coopname = (store as any).currentCoopname ?? '';
    const remoteConfigs: IWorkspaceConfig[] = await installRemoteExtensions(
      coopname,
      router,
    );
    for (const config of remoteConfigs) {
      if (config?.workspace && config?.routes?.length) {
        store.setRoutes(config.workspace, config.routes as any);
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
  } catch (err) {
    console.error('[init-installed-extensions] remote pass failed:', err);
  }
}

// Функция для динамической загрузки маршрутов конкретного расширения
export async function loadExtensionRoutes(
  extensionName: string,
  router: Router,
) {
  const store = useDesktopStore();

  try {

    // Получаем функцию установки из регистра
    const installFunction = extensionsRegistry[extensionName];

    if (!installFunction) {
      return;
    }

    const result = await installFunction();

    // Поддержка обоих форматов: массив или одиночный объект (для обратной совместимости)
    const workspaceConfigs: IWorkspaceConfig[] = Array.isArray(result) ? result : [result];

    // Обрабатываем каждый workspace из расширения
    for (const config of workspaceConfigs) {
      if (config?.workspace && config?.routes?.length) {
        // Записываем маршруты в соответствующий workspace
        store.setRoutes(config.workspace, config.routes as any);

        // Регистрируем маршруты в router
        const baseRoute = router.getRoutes().find((r) => r.name === 'base');
        if (baseRoute) {
          config.routes.forEach((r: any) => {
            // Проверяем, не зарегистрирован ли уже маршрут
            const existingRoute = router
              .getRoutes()
              .find((route) => route.name === r.name);
            if (!existingRoute) {
              router.addRoute('base', r);
            } else {
            }
          });
        }
      }
    }


  } catch (error) {
    console.error(
      `📦 [LoadExtensionRoutes] Failed to load routes for extension "${extensionName}":`,
      error,
    );
  }
}
