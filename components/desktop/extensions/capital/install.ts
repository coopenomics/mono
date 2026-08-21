import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import type { DesktopWalletCard } from 'src/shared/lib/types/desktop-wallet';
import { ContributorsPage, ProgramExpensesPage, ProgramExpensePage, AllocationsPage, MeasuresPage, MyTasksPage, MyProjectsPage, ArtifactsListPage } from './pages';
import { CapitalBase } from './pages/CapitalBase';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectPage } from './pages/ProjectPage';
import { ComponentPage } from './pages/ComponentPage';
import { IssuePage } from './pages/IssuePage';
import { IssueDescriptionPage } from './pages/IssueDescriptionPage';
import { IssueRequirementsPage } from './pages/IssueRequirementsPage';
import { IssueCommitsPage } from './pages/IssueCommitsPage';
import { IssueHistoryPage } from './pages/IssueHistoryPage';
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
import { ComponentsListPage } from './pages/ComponentsListPage';
import {
  buildProjectTreeChildren,
  COOP_PROJECT_TREE_NAMES,
  MY_PROJECT_TREE_NAMES,
  COMPONENTS_TREE_NAMES,
  COMPONENTS_TREE_OPTIONS,
} from './routes/projectTreeChildren';

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

  const projectTreePages = {
    IssuePage,
    IssueDescriptionPage,
    IssueRequirementsPage,
    IssueCommitsPage,
    IssueHistoryPage,
    ComponentPage,
    ComponentDescriptionPage,
    ComponentPlanningPage,
    ComponentContributorsPage,
    ComponentHistoryPage,
    ComponentTasksPage,
    ComponentRequirementsPage,
    ComponentVotingPage,
    ComponentResultsPage,
    RequirementDetailPage,
    ProjectPage,
    ProjectDescriptionPage,
    ProjectPlanningPage,
    ProjectContributorsPage,
    ProjectHistoryPage,
    ProjectComponentsPage,
    ProjectRequirementsPage,
  };

  const coopProjectTreeChildren = buildProjectTreeChildren(
    projectTreePages,
    COOP_PROJECT_TREE_NAMES,
  );
  const myProjectTreeChildren = buildProjectTreeChildren(
    projectTreePages,
    MY_PROJECT_TREE_NAMES,
  );

  const componentsTreeChildren = buildProjectTreeChildren(
    projectTreePages,
    COMPONENTS_TREE_NAMES,
    COMPONENTS_TREE_OPTIONS,
  );

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
          requires: 'Capital:access',
        },
        path: '/:coopname/capital',
        name: 'capital',
        component: markRaw(CapitalBase),
        // Порядок рейла — сверху вниз по укрупнению работы: профиль →
        // проекты → компоненты → задачи → коммиты → результаты → приглашения →
        // участники → деньги → лента
        children: [
          {
            path: 'wallet',
            name: 'capital-wallet',
            component: markRaw(CapitalProfilePage),
            meta: {
              title: 'Профиль',
              icon: 'fa-solid fa-wallet',
              requires: 'Capital:access',
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
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [],
          },
          {
            path: 'my-projects',
            name: 'capital-my-projects',
            component: markRaw(MyProjectsPage),
            meta: {
              title: 'Мои проекты',
              icon: 'folder_special',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: myProjectTreeChildren,
          },
          {
            path: 'tracker',
            name: 'tracker',
            component: markRaw(TrackerPage),
            meta: {
              title: 'Время',
              icon: 'fa-solid fa-clock',
              requires: 'Capital:access',
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
              title: 'Проекты',
              icon: 'fa-solid fa-list',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: false,
            },
            children: coopProjectTreeChildren,
          },
          {
            // Тот же список, что и внутри проекта, но без первого уровня:
            // все компоненты кооператива подряд, у каждого — свои задачи
            path: 'components',
            name: 'components-list',
            component: markRaw(ComponentsListPage),
            meta: {
              title: 'Компоненты',
              icon: 'account_tree',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: false,
            },
            children: componentsTreeChildren,
          },
          {
            path: 'my-tasks',
            name: 'capital-my-tasks',
            component: markRaw(MyTasksPage),
            meta: {
              title: 'Задачи',
              icon: 'assignment',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [
              {
                path: ':issue_hash',
                name: 'my-task-issue',
                component: markRaw(IssuePage),
                meta: {
                  title: 'Задача',
                  icon: 'task',
                  requires: 'Capital:access',
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
                children: [
                  {
                    path: '',
                    name: 'my-task-issue-redirect',
                    redirect: { name: 'my-task-issue-description' },
                  },
                  {
                    path: 'description',
                    name: 'my-task-issue-description',
                    component: markRaw(IssueDescriptionPage),
                    meta: {
                      title: 'Описание задачи',
                      icon: 'description',
                      requires: 'Capital:access',
                      agreements: agreementsBase,
                      requiresAuth: true,
                      hidden: true,
                    },
                  },
                  {
                    path: 'requirements',
                    name: 'my-task-issue-requirements',
                    component: markRaw(IssueRequirementsPage),
                    meta: {
                      title: 'Артефакты задачи',
                      icon: 'assignment',
                      requires: 'Capital:access',
                      agreements: agreementsBase,
                      requiresAuth: true,
                      hidden: true,
                    },
                  },
                  {
                    path: 'commits',
                    name: 'my-task-issue-commits',
                    component: markRaw(IssueCommitsPage),
                    meta: {
                      title: 'Коммиты задачи',
                      icon: 'commit',
                      requires: 'Capital:access',
                      agreements: agreementsBase,
                      requiresAuth: true,
                      hidden: true,
                    },
                  },
                  {
                    path: 'history',
                    name: 'my-task-issue-history',
                    component: markRaw(IssueHistoryPage),
                    meta: {
                      title: 'История задачи',
                      icon: 'history',
                      requires: 'Capital:access',
                      agreements: agreementsBase,
                      requiresAuth: true,
                      hidden: true,
                    },
                  },
                ],
              },
            ],
          },
          {
            path: 'artifacts',
            name: 'artifacts-list',
            component: markRaw(ArtifactsListPage),
            meta: {
              title: 'Артефакты',
              icon: 'article',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
            },
          },
          {
            path: 'commits',
            name: 'commits-list',
            component: markRaw(MasterCommitsPage),
            meta: {
              title: 'Коммиты',
              icon: 'fa-solid fa-code-commit',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: false,
            },
            children: [],
          },
          {
            // Отдельного стола голосований нет: голосование — часть приёмки
            // результата, и пайщик видит его на «Результатах». Ветка оставлена
            // ради ссылок на страницу голосования по конкретному компоненту.
            path: 'voting',
            name: 'voting',
            component: markRaw(ProjectsVotingPage),
            meta: {
              title: 'Голосования',
              icon: 'how_to_vote',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
              hidden: true,
            },
            children: [
              {
                path: ':project_hash',
                name: 'voting-detail',
                component: markRaw(ComponentVotingPage),
                meta: {
                  title: 'Голосование',
                  icon: 'how_to_vote',
                  requires: 'Capital:access',
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
            ],
          },
          {
            path: 'results',
            name: 'results',
            component: markRaw(ProjectsResultsPage),
            meta: {
              title: 'Результаты',
              icon: 'assessment',
              requires: 'Capital:access',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [
              {
                path: ':project_hash',
                name: 'results-detail',
                component: markRaw(ComponentResultsPage),
                meta: {
                  title: 'Результаты',
                  icon: 'assessment',
                  requires: 'Capital:access',
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
              },
            ],
          },
          {
            path: 'invitations',
            name: 'my-invitations',
            component: markRaw(InvitationsPage),
            meta: {
              title: 'Приглашения',
              icon: 'fa-solid fa-envelope-open-text',
              requires: 'Capital:access',
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
              requires: 'Capital:board',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [],
          },
          {
            path: 'measures',
            name: 'capital-measures',
            component: markRaw(MeasuresPage),
            meta: {
              title: 'Меры',
              icon: 'straighten',
              requires: 'Capital:chairman',
              agreements: agreementsBase,
              requiresAuth: true,
              // Меры заводятся текстом прямо в плане компонента, отдельный
              // раздел в меню только отвлекает. Страница остаётся доступной
              // по прямой ссылке — там видно свои меры и можно их выключить.
              hidden: true,
            },
            children: [],
          },
          {
            path: 'allocations',
            name: 'capital-allocations',
            component: markRaw(AllocationsPage),
            meta: {
              title: 'Аллокации',
              icon: 'savings',
              requires: 'Capital:board',
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
              requires: 'Capital:board',
              agreements: agreementsBase,
              requiresAuth: true,
            },
            children: [
              {
                path: ':expense_hash',
                name: 'capital-program-expense',
                component: markRaw(ProgramExpensePage),
                meta: {
                  title: 'Расход',
                  icon: 'receipt_long',
                  requires: 'Capital:board',
                  agreements: agreementsBase,
                  requiresAuth: true,
                  hidden: true,
                },
                children: [],
              },
            ],
          },
          {
            path: 'activity',
            name: 'activity-feed',
            component: markRaw(ActivityFeedPage),
            meta: {
              title: 'Лента',
              icon: 'fa-solid fa-stream',
              requires: 'Capital:access',
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

/**
 * Кошельки, которые «Благорост» приносит на стол пайщика (путь B).
 * Единый кошелёк программы у пайщика (`w.cap.blago`). Генератор
 * (`w.cap.gen`) — кооперативный кошелёк без L3-разреза, на столе пайщика
 * НЕ показываем.
 */
export const walletCards: DesktopWalletCard[] = [
  {
    wallet_name: 'w.cap.blago',
    label: 'Благорост',
    accent: 'blagorost',
    icon: 'savings',
  },
];
