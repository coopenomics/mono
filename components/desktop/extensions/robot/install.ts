import './i18n';
import { markRaw } from 'vue';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { RobotRegistryPage } from './pages/RobotRegistryPage';
import { RobotJournalPage } from './pages/RobotJournalPage';
import { RobotAdminPage } from './pages/RobotAdminPage';
import { t } from './i18n';

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
      title: t('robot.install.title'),
      icon: 'smart_toy',
      defaultRoute: 'robot-registry',
      routes: [
        {
          meta: {
            title: t('robot.install.title'),
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
                title: t('robot.install.registryTitle'),
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
                title: t('robot.install.journalTitle'),
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
                title: t('robot.install.adminTitle'),
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
