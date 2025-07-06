import type { Router } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';

export async function useInitExtensionsProcess(router: Router) {
  const store = useDesktopStore();
  // Загружаем все модули расширений
  const modules = import.meta.glob('../../../extensions/**/install.{ts,js}');

  for (const path in modules) {
    const mod = await modules[path]();
    if (mod?.default) {
      // Ожидаем, что расширение возвращает объект { workspace, routes }
      const result = await mod.default();
      if (result?.workspace && result?.routes?.length) {
        // Записываем маршруты в соответствующий workspace
        store.setRoutes(result.workspace, result.routes);
        // Регистрируем маршруты в router, добавляя их в базовый родительский маршрут (например, "base")
        const baseRoute = router.getRoutes().find((r) => r.name === 'base');
        if (baseRoute) {
          result.routes.forEach((r: any) => router.addRoute('base', r));
        }
      }
    }
  }
}
