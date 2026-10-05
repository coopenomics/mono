import './i18n';
import { markRaw } from 'vue';
import { ListOfAgendaQuestions } from 'src/pages/Cooperative/ListOfAgenda';
import { ListOfParticipantsPage } from 'src/pages/Cooperative/ListOfParticipants';
import { ParticipantDetailsPage } from 'src/pages/Cooperative/ParticipantDetails';
// Страница «Персонал» (назначение ролей, Story 6.11) временно снята со стола
// совета: управление наборами возможностей не доведено до конца, а
// полурабочий экран раздачи прав опаснее его отсутствия. Возвращается
// вместе с доделанной фичей — снять комментарии здесь и у маршрута ниже.
// import { PersonnelPage } from 'src/pages/Cooperative/Personnel';
import { ListOfDocumentsPage } from 'src/pages/Cooperative/ListOfDocuments';
import { DocumentDetailsPage } from 'src/pages/Cooperative/DocumentDetails';
import { DocumentTemplatesPage } from 'src/pages/Cooperative/DocumentTemplates';
import { PaymentsPage } from 'src/pages/Cooperative/Payments';
import { ListOfMeetsPage } from 'src/pages/Cooperative/ListOfMeets';
import { MeetDetailsPage } from 'src/pages/Cooperative/MeetDetails';
import { UnionPageListOfCooperatives } from 'src/pages/Union/ListOfCooperatives';
import { ExpensesRegistryPage } from 'app/extensions/expenses/pages';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { t } from './i18n';

export default async function (): Promise<IWorkspaceConfig[]> {
  return [{
    workspace: 'soviet',
    extension_name: 'soviet',
    title: t('soviet.install.title'),
    icon: 'fa-solid fa-gavel',
    defaultRoute: 'agenda', // Маршрут по умолчанию для рабочего стола совета
    routes: [
      {
        meta: {
          title: t('soviet.install.title'),
          icon: 'fa-regular fa-circle',
          requires: 'Agenda:read',
        },
        path: '/:coopname/soviet',
        name: 'soviet',
        children: [
          {
            path: 'agenda',
            name: 'agenda',
            component: markRaw(ListOfAgendaQuestions),
            meta: {
              title: t('soviet.install.agendaTitle'),
              icon: 'fa-solid fa-check-to-slot',
              requires: 'Agenda:read',
            },
          },
          {
            path: 'participants',
            name: 'participants',
            component: markRaw(ListOfParticipantsPage),
            meta: {
              title: t('soviet.install.participantsRegistryTitle'),
              icon: 'fa-solid fa-users',
              requires: 'Participant:read:all',
            },
          },
          {
            // Страница пайщика: сюда ведут «Открыть страницу» из правой панели
            // реестра и находка из единого поиска. Живёт рядом с реестром, а не
            // внутри него, — подсветку раздела в меню держит menuKey.
            path: 'participants/:username',
            name: 'participant-details',
            component: markRaw(ParticipantDetailsPage),
            meta: {
              title: t('soviet.install.participantTitle'),
              requires: 'Participant:read:all',
              hidden: true,
              menuKey: 'participants',
            },
          },
          // Временно скрыто — см. комментарий у импорта PersonnelPage.
          // {
          //   path: 'personnel',
          //   name: 'personnel',
          //   component: markRaw(PersonnelPage),
          //   meta: {
          //     title: 'Персонал',
          //     icon: 'fa-solid fa-user-shield',
          //     requires: 'Personnel:read',
          //   },
          // },
          {
            path: 'documents',
            name: 'documents',
            component: markRaw(ListOfDocumentsPage),
            meta: {
              title: t('soviet.install.documentsRegistryTitle'),
              icon: 'fa-solid fa-file-invoice',
              requires: 'Document:read:all',
            },
            children: [
              {
                // Вкладка реестра: шаблоны документов кооператива, их редакции и
                // утверждение советом (фабрика утверждений документов). Стоит
                // раньше `:hash`, иначе слово «templates» примется за хэш.
                path: 'templates',
                name: 'document-templates',
                component: markRaw(DocumentTemplatesPage),
                meta: {
                  title: t('soviet.install.documentTemplatesTitle'),
                  requires: 'DocumentTemplate:read',
                  hidden: true,
                },
              },
              {
                // Отдельная страница документа (deep-link из поиска и реестра).
                path: ':hash',
                name: 'document-details',
                component: markRaw(DocumentDetailsPage),
                meta: {
                  title: t('soviet.install.documentTitle'),
                  requires: 'Document:read:all',
                  hidden: true,
                },
              },
            ],
          },
          {
            path: 'payments/:username?',
            name: 'payments',
            component: markRaw(PaymentsPage),
            meta: {
              title: t('soviet.install.paymentsRegistryTitle'),
              icon: 'fa-solid fa-file-invoice',
              requires: 'Payment:read:all',
            },
          },
          {
            // Реестр расходов кооператива: единая таблица всех расходов по всем
            // пулам-кошелькам (без фильтра по кошельку — колонка «Кошелёк (пул)»
            // показывает источник списания). Совет наблюдает; клик по строке
            // открывает деталь расхода (generic `expenses-detail`). Фильтр по
            // конкретному пулу — на странице расходов программы (capital).
            path: 'expenses',
            name: 'soviet-expenses-registry',
            component: markRaw(ExpensesRegistryPage),
            meta: {
              title: t('soviet.install.expensesRegistryTitle'),
              icon: 'receipt_long',
              requires: 'Expense:read:all',
            },
          },
          {
            path: 'meets',
            name: 'meets',
            component: markRaw(ListOfMeetsPage),
            meta: {
              title: t('soviet.install.meetsRegistryTitle'),
              icon: 'fa-solid fa-users-between-lines',
              requires: 'Meet:create',
            },
            children: [
              {
                path: ':hash',
                name: 'meet-details',
                component: markRaw(MeetDetailsPage),
              },
            ],
          },
          {
            path: 'union/cooperatives',
            name: 'union-cooperatives',
            component: markRaw(UnionPageListOfCooperatives),
            meta: {
              title: t('soviet.install.cooperativesRegistryTitle'),
              icon: 'fa-solid fa-handshake',
              requires: 'Union:read',
              conditions: 'coopname === "voskhod"',
              requiresAuth: true,
            },
          },
        ],
      },
    ],
  }];
}
