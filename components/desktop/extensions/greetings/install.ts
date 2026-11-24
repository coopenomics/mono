import './i18n';
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { JournalPage } from './pages/JournalPage';
import { CalendarPage } from './pages/CalendarPage';
import { t } from './i18n';

/**
 * Приложение «Поздравления»: шаблоны председателя, журнал отправок и
 * календарь дней рождения. Страницы читает совет, шаблоны правит председатель —
 * права выдаёт таблица прав приложения на сервере.
 */
export default async function (): Promise<IWorkspaceConfig[]> {
  const page = (requires: string) => ({ requires, agreements: agreementsBase, requiresAuth: true });
  return [
    {
      workspace: 'greetings',
      extension_name: 'greetings',
      title: t('greetings.install.title'),
      icon: 'cake',
      defaultRoute: 'greetings-templates',
      routes: [
        {
          meta: { title: t('greetings.install.title'), icon: 'cake', requires: 'Greetings:read' },
          path: '/:coopname/greetings',
          name: 'greetings',
          children: [
            {
              path: 'templates',
              name: 'greetings-templates',
              component: markRaw(TemplatesPage),
              meta: { title: t('greetings.install.templatesTitle'), icon: 'description', ...page('Greetings:read') },
            },
            {
              path: 'templates/:id',
              name: 'greetings-template',
              component: markRaw(TemplateEditorPage),
              meta: {
                title: t('greetings.install.templateTitle'),
                icon: 'edit_note',
                hidden: true,
                menuKey: 'greetings-templates',
                ...page('Greetings:read'),
              },
            },
            {
              path: 'journal',
              name: 'greetings-journal',
              component: markRaw(JournalPage),
              meta: { title: t('greetings.install.journalTitle'), icon: 'history', ...page('Greetings:read') },
            },
            {
              path: 'calendar',
              name: 'greetings-calendar',
              component: markRaw(CalendarPage),
              meta: { title: t('greetings.install.calendarTitle'), icon: 'event', ...page('Greetings:read') },
            },
          ],
        },
      ],
    },
  ];
}
