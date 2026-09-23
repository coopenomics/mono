import './i18n';
import { markRaw } from 'vue';
import { CalendarPage, ChatCoopPage, MobileClientPage, SecretaryRoomsPage, TranscriptionsPage, TranscriptionDetailPage } from './pages';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { t } from './i18n';

export default async function (): Promise<IWorkspaceConfig[]> {
  console.log('📨 [ChatCoop Install] Extension install function called');
  return [{
    workspace: 'chatcoop',
    extension_name: 'chatcoop',
    title: t('chatcoop.install.extensionName'),
    icon: 'fa-solid fa-comments',
    defaultRoute: 'chat', // Маршрут по умолчанию для рабочего стола чата
    routes: [
      {
        meta: {
          title: t('chatcoop.install.extensionName'),
          icon: 'fa-solid fa-comments',
          roles: ['chairman', 'member', 'user'],
        },
        path: '/:coopname/chatcoop',
        name: 'chatcoop',
        children: [
          {
            path: 'chat',
            name: 'chatcoop-chat',
            component: markRaw(ChatCoopPage),
            meta: {
              title: t('chatcoop.install.quickClientNavTitle'),
              icon: 'fa-solid fa-comments',
              roles: ['chairman', 'member', 'user'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'mobile',
            name: 'chatcoop-mobile',
            component: markRaw(MobileClientPage),
            meta: {
              title: t('chatcoop.install.mobileClientNavTitle'),
              icon: 'fa-solid fa-mobile-alt',
              roles: ['chairman', 'member', 'user'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'calendar',
            name: 'chatcoop-calendar',
            component: markRaw(CalendarPage),
            meta: {
              title: t('chatcoop.install.calendarNavTitle'),
              icon: 'fa-solid fa-calendar-days',
              roles: ['chairman', 'member', 'user'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'transcriptions',
            name: 'chatcoop-transcriptions',
            component: markRaw(TranscriptionsPage),
            meta: {
              title: t('chatcoop.install.transcriptionsNavTitle'),
              icon: 'fa-solid fa-file-lines',
              roles: ['chairman', 'member', 'user'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'secretary-rooms',
            name: 'chatcoop-secretary-rooms',
            component: markRaw(SecretaryRoomsPage),
            meta: {
              title: t('chatcoop.install.secretaryRoomsNavTitle'),
              icon: 'fa-solid fa-user-shield',
              roles: ['chairman', 'member'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'transcriptions/:id',
            name: 'chatcoop-transcription-detail',
            component: markRaw(TranscriptionDetailPage),
            meta: {
              title: t('chatcoop.install.transcriptionDetailNavTitle'),
              icon: 'fa-solid fa-file-lines',
              roles: ['chairman', 'member', 'user'],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [],
          },

        ],
      },
    ],
  }];

}
