import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { ReportsPage } from './pages';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'reports',
    extension_name: 'reports',
    title: 'Отчёты ФНС',
    icon: 'fa-solid fa-file-invoice',
    defaultRoute: 'reports-main',
    routes: [
      {
        meta: {
          title: 'Отчёты ФНС',
          icon: 'fa-solid fa-file-invoice',
          roles: ['chairman'],
        },
        path: '/:coopname/reports',
        name: 'reports',
        children: [
          {
            path: '',
            name: 'reports-main',
            component: markRaw(ReportsPage),
            meta: {
              title: 'Расписание отчётов',
              icon: 'fa-solid fa-calendar-days',
              roles: ['chairman'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
        ],
      },
    ],
  }];
}
