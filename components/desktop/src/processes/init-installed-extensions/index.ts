import type { Router } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { extensionsRegistry, getAvailableExtensions } from './extensions-registry';

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

          // Записываем маршруты в соответствующий workspace.
          // ВАЖНО: setRoutes привязывает маршруты только к workspace, который
          // backend объявил в AppRegistry (см. desktop.interactor). Если фронт
          // вернул workspace, которого нет в desktop'е с бэкенда, маршруты
          // молча потеряются — поэтому предупреждаем явно.
          const workspaceExists = store.workspaceMenus.some(
            (w) => w.workspaceName === config.workspace,
          );
          if (!workspaceExists) {
            console.warn(
              `📦 [InitExtensions] Расширение "${extensionName}" вернуло workspace ` +
              `"${config.workspace}", которого нет в desktop с бэкенда (AppRegistry). ` +
              'Маршруты этого стола не будут отображены — добавьте стол в extensions.registry.ts.',
            );
          }
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
    } catch (error) {
      // Продолжаем загрузку других расширений даже если одно не загрузилось,
      // но НЕ глотаем ошибку молча — иначе сломанный install выглядит как
      // «пустой стол» без единой подсказки в консоли.
      console.error(
        `📦 [InitExtensions] Не удалось загрузить расширение "${extensionName}":`,
        error,
      );
    }
  }


}

// Функция для динамической загрузки маршрутов конкретного расширения.
// Возвращает список workspace-конфигов расширения — вызывающий код
// (кнопки включения) использует `defaultRoute` первого стола для редиректа
// на «домашнюю» страницу расширения (для расширений с онбордингом это
// страница подключения, см. канон в EXTENSIONS_SCHEMA_SYSTEM.md).
export async function loadExtensionRoutes(
  extensionName: string,
  router: Router,
): Promise<IWorkspaceConfig[]> {
  const store = useDesktopStore();

  try {

    // Получаем функцию установки из регистра
    const installFunction = extensionsRegistry[extensionName];

    if (!installFunction) {
      return [];
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

    return workspaceConfigs;
  } catch (error) {
    console.error(
      `📦 [LoadExtensionRoutes] Failed to load routes for extension "${extensionName}":`,
      error,
    );
    return [];
  }
}
