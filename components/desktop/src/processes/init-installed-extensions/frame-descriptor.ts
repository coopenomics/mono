/**
 * Описатель изолированного фронта приложения каталога (487-18).
 *
 * Пакет поставляет фронт одним файлом. Прежний вид файла — сценарий
 * `install.js`, который стол выполнял в своём окне: код приложения получал
 * всё, что доступно столу, включая подпись от имени пайщика. Новый вид —
 * описатель: данные о рабочем столе и страница приложения. Стол такой файл не
 * выполняет, а показывает страницу в изолированной рамке.
 *
 *     { "coopenomicsFrontend": "frame",
 *       "workspace": { "name": "exampleapp", "title": "Example", "icon": "extension" },
 *       "html": "<!doctype html>…" }
 */
import { defineComponent, h, markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { IsolatedAppFrame, type FrameDescriptor } from 'src/widgets/IsolatedAppFrame';

export { parseFrameDescriptor } from 'src/widgets/IsolatedAppFrame';

/**
 * Рабочий стол изолированного фронта: один маршрут, страница которого —
 * рамка стола с HTML приложения. Кода приложения в окне стола нет.
 */
export function frameWorkspace(packageId: string, descriptor: FrameDescriptor): IWorkspaceConfig[] {
  const { name, title, icon } = descriptor.workspace;
  const page = markRaw(
    defineComponent({
      name: 'IsolatedAppPage',
      setup: () => () => h(IsolatedAppFrame, { packageId, title, html: descriptor.html }),
    }),
  );
  const config = {
    extension_name: name,
    workspace: name,
    title,
    icon,
    defaultRoute: `${name}-home`,
    routes: [
      {
        path: name,
        name: `${name}-home`,
        component: page,
        meta: { title, icon, requiresAuth: true },
      },
    ],
  };
  return [config as unknown as IWorkspaceConfig];
}
