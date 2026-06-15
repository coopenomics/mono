import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import { ContributorsPage, ProgramExpensesPage, ProgramExpensePage } from './pages';
import { CapitalBase } from './pages/CapitalBase';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectPage } from './pages/ProjectPage';
import { ComponentPage } from './pages/ComponentPage';
import { IssuePage } from './pages/IssuePage';
import { TrackerPage } from './pages';
import { ProjectsVotingPage } from './pages';
import { ProjectsResultsPage } from './pages';
// import { ProjectsInvitesPage } from './pages';
import { CapitalProfilePage, CapitalRegistrationPage, MasterCommitsPage, InvitationsPage } from './pages';
import { ProjectDescriptionPage } from './pages/ProjectDescriptionPage';
// import { ProjectInviteViewerPage } from './pages';
// import { ProjectInviteEditorPage } from './pages/ProjectInviteEditorPage';
// import { ComponentInvitePage } from './pages/ComponentInvitePage';
import { ProjectPlanningPage } from './pages/ProjectPlanningPage';
import { ProjectContributorsPage } from './pages/ProjectContributorsPage';
import { ProjectComponentsPage } from './pages/ProjectComponentsPage';
import { ProjectRequirementsPage } from './pages/ProjectRequirementsPage';
import { RequirementDetailPage } from './pages/RequirementDetailPage';
import { ComponentDescriptionPage } from './pages/ComponentDescriptionPage';
import { ComponentPlanningPage } from './pages/ComponentPlanningPage';
import { ComponentContributorsPage } from './pages/ComponentContributorsPage';
import { ComponentTasksPage } from './pages/ComponentTasksPage';
import { ComponentRequirementsPage } from './pages/ComponentRequirementsPage';
import { ComponentVotingPage } from './pages/ComponentVotingPage';
import { ComponentResultsPage } from './pages/ComponentResultsPage';
import { ProjectHistoryPage } from './pages/ProjectHistoryPage';
import { ComponentHistoryPage } from './pages/ComponentHistoryPage';
import { ActivityFeedPage } from './pages/ActivityFeedPage';
import { registerCapitalDecisionHandlers } from './app/extensions';
import { registerExpenseWallet } from 'src/shared/lib/expense-wallets';

export default async function (): Promise<IWorkspaceConfig[]> {
  // Регистрируем обработчики решений для расширения capital
  registerCapitalDecisionHandlers();
  // Пул расходов программы — в общесистемный реестр кошельков расходов
  // (страница «Расходы» стола совета собирает пулы всех расширений).
  registerExpenseWallet({
    wallet: 'w.cap.pgexp',
    title: 'Пул расходов программы «Благорост»',
    subtitle: 'Программные расходы ЦПП «Благорост»',
    icon: 'receipt_long',
    program: 'blagorost',
    route: { name: 'capital-program-expenses' },
  });
  return [{
    workspace: 'capital',
    extension_name: 'capital',
    title: 'Благорост',
    icon: 'fa-solid fa-seedling',
    defaultRoute: 'capital-wallet', // Маршрут по умолчанию для рабочего стола
    routes: [
      {
        meta: {
          title: 'Шаблон',
          icon: 'fa-solid fa-user-tie',
          roles: [],
        },
        path: '/:coopname/capital',
        name: 'capital',
        component: markRaw(CapitalBase),
        children: [
          {
            path: 'wallet',
            name: 'capital-wallet',
            component: markRaw(CapitalProfilePage),
            meta: {
              title: 'Профиль',
              icon: 'fa-solid fa-wallet',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'registration',
            name: 'capital-registration',
            component: markRaw(CapitalRegistrationPage),
            meta: {
              title: 'Регистрация',
              icon: 'fa-solid fa-user-plus',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [],
          },

          {
            path: 'projects',
            name: 'projects-list',
            component: markRaw(ProjectsListPage),
            meta: {
              title: 'Мастерская',
              icon: 'fa-solid fa-list',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: false,
            },
            children: [],
          },
          {
            path: 'invitations',
            name: 'my-invitations',
            component: markRaw(InvitationsPage),
            meta: {
              title: 'Мои приглашения',
              icon: 'fa-solid fa-envelope-open-text',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          // {
          //   path: 'processes',
          //   name: 'processes',
          //   component: markRaw(ProcessesPage),
          //   meta: {
          //     title: 'Процессы',
          //     icon: 'fa-solid fa-diagram-project',
          //     roles: [],
          //     agreements: agreementsBase,
          //     requiresAuth: true,
          //   },
          //   children: [],
          // },
          {
            path: 'tracker',
            name: 'tracker',
            component: markRaw(TrackerPage),
            meta: {
              title: 'Мое время',
              icon: 'fa-solid fa-clock',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'commits',
            name: 'commits-list',
            component: markRaw(MasterCommitsPage),
            meta: {
              title: 'Коммиты',
              icon: 'fa-solid fa-code-commit',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: false,
            },
            children: [],
          },

          {
            path: 'voting',
            name: 'voting',
            component: markRaw(ProjectsVotingPage),
            meta: {
              title: 'Голосования',
              icon: 'fa-solid fa-vote-yea',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'results',
            name: 'results',
            component: markRaw(ProjectsResultsPage),
            meta: {
              title: 'Результаты',
              icon: 'fa-solid fa-chart-line',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },

          {
            path: 'contributors',
            name: 'contributors',
            component: markRaw(ContributorsPage),
            meta: {
              title: 'Участники',
              icon: 'fa-solid fa-users',
              roles: ['chairman', 'member'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'program-expenses',
            name: 'capital-program-expenses',
            component: markRaw(ProgramExpensesPage),
            meta: {
              title: 'Расходы',
              icon: 'receipt_long',
              roles: ['chairman', 'member'],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'program-expenses/:expense_hash',
            name: 'capital-program-expense',
            component: markRaw(ProgramExpensePage),
            meta: {
              title: 'Расход',
              icon: 'receipt_long',
              roles: ['chairman', 'member'],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [],
          },
          {
            path: 'activity',
            name: 'activity-feed',
            component: markRaw(ActivityFeedPage),
            meta: {
              title: 'Лента',
              icon: 'fa-solid fa-stream',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          // {
          //   path: 'projects-invites',
          //   name: 'projects-invites',
          //   component: markRaw(ProjectsInvitesPage),
          //   meta: {
          //     title: 'Приглашения',
          //     icon: 'fa-solid fa-envelope-open-text',
          //     roles: [],
          //     agreements: agreementsBase,
          //     requiresAuth: true,
          //   },
          //   children: [],
          // },



          {
            path: 'projects/:project_hash',
            name: 'project-base',
            component: markRaw(ProjectPage),
            meta: {
              title: 'Проект',
              icon: 'fa-solid fa-folder-tree',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [
              {
                name: 'project-redirect',
                path: '',
                redirect: { name: 'project-description' },
              },
              {
                path: 'description',
                name: 'project-description',
                component: markRaw(ProjectDescriptionPage),
                meta: {
                  title: 'Описание проекта',
                  icon: 'fa-solid fa-file-alt',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              // {
              //   path: 'invite',
              //   name: 'project-invite-editor',
              //   component: markRaw(ProjectInviteEditorPage),
              //   meta: {
              //     title: 'Редактирование приглашения',
              //     icon: 'fa-solid fa-envelope',
              //     roles: [],
              //     agreements: agreementsBase,
              //     requiresAuth: true,
              //     hidden: true,
              //   },
              // },
              {
                path: 'planning',
                name: 'project-planning',
                component: markRaw(ProjectPlanningPage),
                meta: {
                  title: 'Планирование проекта',
                  icon: 'fa-solid fa-chart-line',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'contributors',
                name: 'project-contributors',
                component: markRaw(ProjectContributorsPage),
                meta: {
                  title: 'Участники проекта',
                  icon: 'fa-solid fa-user-friends',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'history',
                name: 'project-history',
                component: markRaw(ProjectHistoryPage),
                meta: {
                  title: 'История проекта',
                  icon: 'fa-solid fa-history',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'components',
                name: 'project-components',
                component: markRaw(ProjectComponentsPage),
                meta: {
                  title: 'Компоненты проекта',
                  icon: 'fa-solid fa-folder-tree',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'requirements/:story_hash',
                name: 'project-requirement-detail',
                component: markRaw(RequirementDetailPage),
                meta: {
                  title: 'Артефакт',
                  icon: 'fa-solid fa-clipboard-list',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'requirements',
                name: 'project-requirements',
                component: markRaw(ProjectRequirementsPage),
                meta: {
                  title: 'Артефакты проекта',
                  icon: 'fa-solid fa-clipboard-list',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              // {
              //   path: 'invite',
              //   name: 'project-invite',
              //   component: markRaw(ProjectInviteViewerPage),
              //   meta: {
              //     title: 'Приглашения в проект',
              //     icon: 'fa-solid fa-envelope-open-text',
              //     roles: [],
              //     agreements: agreementsBase,
              //     requiresAuth: true,
              //     hidden: true,
              //   },
              //   children: [],
              // },
            ],
          },
          {
            path: 'components/:project_hash',
            name: 'component-base',
            component: markRaw(ComponentPage),
            meta: {
              title: 'Компонент',
              icon: 'fa-solid fa-folder-tree',
              roles: [],
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [
              {
                name: 'component-redirect',
                path: '',
                redirect: { name: 'component-description' },
              },
              {
                path: 'description',
                name: 'component-description',
                component: markRaw(ComponentDescriptionPage),
                meta: {
                  title: 'Описание компонента',
                  icon: 'fa-solid fa-file-alt',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              // {
              //   path: 'invite',
              //   name: 'component-invite-editor',
              //   component: markRaw(ComponentInvitePage),
              //   meta: {
              //     title: 'Редактирование приглашения',
              //     icon: 'fa-solid fa-envelope',
              //     roles: [],
              //     agreements: agreementsBase,
              //     requiresAuth: true,
              //     hidden: true,
              //   },
              // },
              {
                path: 'planning',
                name: 'component-planning',
                component: markRaw(ComponentPlanningPage),
                meta: {
                  title: 'Планирование компонента',
                  icon: 'fa-solid fa-chart-line',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'contributors',
                name: 'component-contributors',
                component: markRaw(ComponentContributorsPage),
                meta: {
                  title: 'Участники компонента',
                  icon: 'fa-solid fa-user-friends',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'history',
                name: 'component-history',
                component: markRaw(ComponentHistoryPage),
                meta: {
                  title: 'История компонента',
                  icon: 'fa-solid fa-history',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'tasks',
                name: 'component-tasks',
                component: markRaw(ComponentTasksPage),
                meta: {
                  title: 'Задачи компонента',
                  icon: 'fa-solid fa-folder-tree',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'requirements/:story_hash',
                name: 'component-requirement-detail',
                component: markRaw(RequirementDetailPage),
                meta: {
                  title: 'Артефакт',
                  icon: 'fa-solid fa-clipboard-list',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'requirements',
                name: 'component-requirements',
                component: markRaw(ComponentRequirementsPage),
                meta: {
                  title: 'Артефакты компонента',
                  icon: 'fa-solid fa-clipboard-list',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'voting',
                name: 'component-voting',
                component: markRaw(ComponentVotingPage),
                meta: {
                  title: 'Голосование компонента',
                  icon: 'fa-solid fa-vote-yea',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
              {
                path: 'results',
                name: 'component-results',
                component: markRaw(ComponentResultsPage),
                meta: {
                  title: 'Результаты компонента',
                  icon: 'fa-solid fa-chart-line',
                  roles: [],
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },

            ],
              },
              {
            path: 'components/:project_hash/:issue_hash',
                name: 'component-issue',
                component: markRaw(IssuePage),
                meta: {
                  title: 'Задача компонента',
                  icon: 'fa-solid fa-task',
                  roles: [],
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
