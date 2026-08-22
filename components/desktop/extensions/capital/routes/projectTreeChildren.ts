import { markRaw, type Component } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';

type PageMap = {
  IssuePage: Component;
  IssueDescriptionPage: Component;
  IssueRequirementsPage: Component;
  IssueCommitsPage: Component;
  IssueHistoryPage: Component;
  ComponentPage: Component;
  ComponentDescriptionPage: Component;
  ComponentPlanningPage: Component;
  ComponentContributorsPage: Component;
  ComponentHistoryPage: Component;
  ComponentTasksPage: Component;
  ComponentRequirementsPage: Component;
  ComponentVotingPage: Component;
  ComponentResultsPage: Component;
  RequirementDetailPage: Component;
  ProjectPage: Component;
  ProjectDescriptionPage: Component;
  ProjectPlanningPage: Component;
  ProjectContributorsPage: Component;
  ProjectHistoryPage: Component;
  ProjectComponentsPage: Component;
  ProjectRequirementsPage: Component;
};

/** Префиксы имён: coop → project/component/component-issue; my → my-project/…; cmp → cmp-component/… */
export type ProjectTreeNamePrefix = {
  project: 'project' | 'my-project' | 'cmp-project';
  component: 'component' | 'my-component' | 'cmp-component';
  issue: 'component-issue' | 'my-component-issue' | 'cmp-component-issue';
};

/** Какие ветки дерева строить и по каким путям (раздел «Компоненты» начинается с компонента). */
export type ProjectTreeOptions = {
  paths?: {
    issue?: string;
    component?: string;
    project?: string;
  };
  include?: Array<'issue' | 'component' | 'project'>;
};

const hiddenMeta = {
  roles: [] as string[],
  agreements: agreementsBase,
  requiresAuth: true,
  hidden: true,
};

/**
 * Дерево проект → компонент → задача.
 * Одни и те же page-компоненты; разные name — для «Кооперативные» и «Мои проекты».
 */
export function buildProjectTreeChildren(
  pages: PageMap,
  names: ProjectTreeNamePrefix,
  options?: ProjectTreeOptions,
) {
  const { project: P, component: C, issue: I } = names;
  const paths = {
    issue: options?.paths?.issue ?? 'components/:project_hash/:issue_hash',
    component: options?.paths?.component ?? 'components/:project_hash',
    project: options?.paths?.project ?? ':project_hash',
  };
  const include = options?.include ?? ['issue', 'component', 'project'];

  const branches = [
    {
      branch: 'issue' as const,
      path: paths.issue,
      name: I,
      component: markRaw(pages.IssuePage),
      meta: { title: 'Задача компонента', icon: 'task', ...hiddenMeta },
      children: [
        {
          path: '',
          name: `${I}-redirect`,
          redirect: { name: `${I}-description` },
        },
        {
          path: 'description',
          name: `${I}-description`,
          component: markRaw(pages.IssueDescriptionPage),
          meta: { title: 'Описание задачи', icon: 'description', ...hiddenMeta },
        },
        {
          path: 'requirements',
          name: `${I}-requirements`,
          component: markRaw(pages.IssueRequirementsPage),
          meta: { title: 'Артефакты задачи', icon: 'assignment', ...hiddenMeta },
        },
        {
          path: 'commits',
          name: `${I}-commits`,
          component: markRaw(pages.IssueCommitsPage),
          meta: { title: 'Коммиты задачи', icon: 'commit', ...hiddenMeta },
        },
        {
          path: 'history',
          name: `${I}-history`,
          component: markRaw(pages.IssueHistoryPage),
          meta: { title: 'История задачи', icon: 'history', ...hiddenMeta },
        },
      ],
    },
    {
      branch: 'component' as const,
      path: paths.component,
      name: `${C}-base`,
      component: markRaw(pages.ComponentPage),
      meta: { title: 'Компонент', icon: 'account_tree', ...hiddenMeta },
      children: [
        {
          path: '',
          name: `${C}-redirect`,
          redirect: { name: `${C}-description` },
        },
        {
          path: 'description',
          name: `${C}-description`,
          component: markRaw(pages.ComponentDescriptionPage),
          meta: { title: 'Описание компонента', icon: 'description', ...hiddenMeta },
        },
        {
          path: 'planning',
          name: `${C}-planning`,
          component: markRaw(pages.ComponentPlanningPage),
          meta: { title: 'Планирование компонента', icon: 'insights', ...hiddenMeta },
        },
        {
          path: 'contributors',
          name: `${C}-contributors`,
          component: markRaw(pages.ComponentContributorsPage),
          meta: { title: 'Участники компонента', icon: 'group', ...hiddenMeta },
        },
        {
          path: 'history',
          name: `${C}-history`,
          component: markRaw(pages.ComponentHistoryPage),
          meta: { title: 'История компонента', icon: 'history', ...hiddenMeta },
        },
        {
          path: 'tasks',
          name: `${C}-tasks`,
          component: markRaw(pages.ComponentTasksPage),
          meta: { title: 'Задачи компонента', icon: 'account_tree', ...hiddenMeta },
        },
        {
          path: 'requirements/:story_hash',
          name: `${C}-requirement-detail`,
          component: markRaw(pages.RequirementDetailPage),
          meta: { title: 'Артефакт', icon: 'assignment', ...hiddenMeta },
        },
        {
          path: 'requirements',
          name: `${C}-requirements`,
          component: markRaw(pages.ComponentRequirementsPage),
          meta: { title: 'Артефакты компонента', icon: 'assignment', ...hiddenMeta },
        },
        {
          path: 'voting',
          name: `${C}-voting`,
          component: markRaw(pages.ComponentVotingPage),
          meta: { title: 'Голосование компонента', icon: 'how_to_vote', ...hiddenMeta },
        },
        {
          path: 'results',
          name: `${C}-results`,
          component: markRaw(pages.ComponentResultsPage),
          meta: { title: 'Результаты компонента', icon: 'insights', ...hiddenMeta },
        },
      ],
    },
    {
      branch: 'project' as const,
      path: paths.project,
      name: `${P}-base`,
      component: markRaw(pages.ProjectPage),
      meta: { title: 'Проект', icon: 'account_tree', ...hiddenMeta },
      children: [
        {
          path: '',
          name: `${P}-redirect`,
          redirect: { name: `${P}-description` },
        },
        {
          path: 'description',
          name: `${P}-description`,
          component: markRaw(pages.ProjectDescriptionPage),
          meta: { title: 'Описание проекта', icon: 'description', ...hiddenMeta },
        },
        {
          path: 'planning',
          name: `${P}-planning`,
          component: markRaw(pages.ProjectPlanningPage),
          meta: { title: 'Планирование проекта', icon: 'insights', ...hiddenMeta },
        },
        {
          path: 'contributors',
          name: `${P}-contributors`,
          component: markRaw(pages.ProjectContributorsPage),
          meta: { title: 'Участники проекта', icon: 'group', ...hiddenMeta },
        },
        {
          path: 'history',
          name: `${P}-history`,
          component: markRaw(pages.ProjectHistoryPage),
          meta: { title: 'История проекта', icon: 'history', ...hiddenMeta },
        },
        {
          path: 'components',
          name: `${P}-components`,
          component: markRaw(pages.ProjectComponentsPage),
          meta: { title: 'Компоненты проекта', icon: 'account_tree', ...hiddenMeta },
        },
        {
          path: 'requirements/:story_hash',
          name: `${P}-requirement-detail`,
          component: markRaw(pages.RequirementDetailPage),
          meta: { title: 'Артефакт', icon: 'assignment', ...hiddenMeta },
        },
        {
          path: 'requirements',
          name: `${P}-requirements`,
          component: markRaw(pages.ProjectRequirementsPage),
          meta: { title: 'Артефакты проекта', icon: 'assignment', ...hiddenMeta },
        },
      ],
    },
  ];

  return branches
    .filter((route) => include.includes(route.branch))
    .map(({ branch: _branch, ...route }) => route);
}

export const COOP_PROJECT_TREE_NAMES: ProjectTreeNamePrefix = {
  project: 'project',
  component: 'component',
  issue: 'component-issue',
};

export const MY_PROJECT_TREE_NAMES: ProjectTreeNamePrefix = {
  project: 'my-project',
  component: 'my-component',
  issue: 'my-component-issue',
};

/**
 * Раздел «Компоненты» — то же дерево, но начинается с компонента:
 * первого уровня проектов в нём нет, поэтому и ветка проекта не строится
 * (по приписке проекта уходим в мастерскую).
 */
export const COMPONENTS_TREE_NAMES: ProjectTreeNamePrefix = {
  project: 'cmp-project',
  component: 'cmp-component',
  issue: 'cmp-component-issue',
};

export const COMPONENTS_TREE_OPTIONS: ProjectTreeOptions = {
  paths: {
    issue: ':project_hash/:issue_hash',
    component: ':project_hash',
  },
  include: ['issue', 'component'],
};
