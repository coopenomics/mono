import { markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { RobotRegistryPage } from './pages/RobotRegistryPage';
import { RobotJournalPage } from './pages/RobotJournalPage';
import { RobotAdminPage } from './pages/RobotAdminPage';

/**
 * Стол «Робот совета». Видимость страниц задаёт бэкенд набором прав
 * (`Robot:read` — члены совета, `Robot:admin` — председатель); рядовой пайщик
 * стола не видит вовсе.
 */
export default async function (): Promise<IWorkspaceConfig[]> {
  return [
    {
      workspace: 'robot',
      extension_name: 'robot',
      title: 'Робот совета',
      icon: 'smart_toy',
      defaultRoute: 'robot-registry',
      routes: [
        {
          meta: {
            title: 'Робот совета',
            icon: 'smart_toy',
            requires: 'Robot:read',
            roles: [],
          },
          path: '/:coopname/robot',
          name: 'robot',
          children: [
            {
              path: 'registry',
              name: 'robot-registry',
              component: markRaw(RobotRegistryPage),
              meta: {
                title: 'Действия автоматизации',
                icon: 'rule',
                requires: 'Robot:read',
                requiresAuth: true,
              },
            },
            {
              path: 'journal',
              name: 'robot-journal',
              component: markRaw(RobotJournalPage),
              meta: {
                title: 'Журнал робота',
                icon: 'history',
                requires: 'Robot:read',
                requiresAuth: true,
              },
            },
            {
              path: 'admin',
              name: 'robot-admin',
              component: markRaw(RobotAdminPage),
              meta: {
                title: 'Состояние робота',
                icon: 'admin_panel_settings',
                requires: 'Robot:admin',
                requiresAuth: true,
              },
            },
          ],
        },
      ],
    },
  ];
}
