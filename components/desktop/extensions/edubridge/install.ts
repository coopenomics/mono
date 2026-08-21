import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig } from 'src/shared/lib/types/workspace';
import {
  AdminAdminsPage,
  AdminAssignmentsPage,
  AdminConnectorsPage,
  AdminCoursesPage,
  AdminMembersPage,
  AdminQueuePage,
  CatalogPage,
  ConfigurePage,
  CourseCardPage,
  MemberLearnersPage,
  MemberOnboardingPage,
  TeacherAssignmentsPage,
  TeacherContributionsPage,
  TeacherOnboardingPage,
  TeacherSettlementPage,
} from './pages';

/**
 * Столы «Образовательного моста». Имена workspace обязаны посимвольно совпадать
 * с `AppRegistry['edubridge'].desktops` в controller — иначе маршруты молча теряются.
 *
 * Видимость — канон грантов: backend (EdubridgeDesktopGrantsProvider) выдаёт
 * права, фронт сверяет `meta.requires`. Гость получает `EduCatalog:read` —
 * каталог открыт до вступления. Страницы с `gate: true` — шлюзы онбординга:
 * показываются, пока не подписана соответствующая оферта.
 *
 *   edubridge          — «Обучение»: каталог (гость/все), курсы и настройка (владелец/администратор)
 *   edubridge-member   — «Моё обучение»: обучающиеся, подписки, доступ (родитель-слушатель)
 *   edubridge-teacher  — «Преподавание»: назначения, взносы РИД (преподаватель)
 */
export default async function (): Promise<IWorkspaceConfig[]> {
  return [
    {
      workspace: 'edubridge',
      extension_name: 'edubridge',
      title: 'Обучение',
      icon: 'school',
      defaultRoute: 'edubridge-catalog',
      routes: [
        {
          meta: { title: 'Обучение', icon: 'school' },
          path: '/:coopname/edubridge',
          name: 'edubridge',
          children: [
            {
              path: 'catalog',
              name: 'edubridge-catalog',
              component: markRaw(CatalogPage),
              meta: { title: 'Каталог курсов', icon: 'school', requires: 'EduCatalog:read' },
              children: [],
            },
            {
              path: 'catalog/:id',
              name: 'edubridge-catalog-course',
              component: markRaw(CourseCardPage),
              meta: { title: 'Курс', icon: 'school', requires: 'EduCatalog:read', hidden: true },
              children: [],
            },
            {
              path: 'configure',
              name: 'edubridge-configure',
              component: markRaw(ConfigurePage),
              meta: {
                title: 'Подключение',
                icon: 'settings',
                requires: 'Extension:configure',
                gate: true,
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'courses',
              name: 'edubridge-admin-courses',
              component: markRaw(AdminCoursesPage),
              meta: {
                title: 'Курсы',
                icon: 'library_books',
                requires: 'EduCourse:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'assignments',
              name: 'edubridge-admin-assignments',
              component: markRaw(AdminAssignmentsPage),
              meta: {
                title: 'Преподаватели',
                icon: 'assignment_ind',
                requires: 'EduAssignment:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'registry',
              name: 'edubridge-admin-registry',
              component: markRaw(AdminMembersPage),
              meta: {
                title: 'Реестр пайщиков',
                icon: 'groups',
                requires: 'EduRegistry:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'queue',
              name: 'edubridge-admin-queue',
              component: markRaw(AdminQueuePage),
              meta: {
                title: 'Очередь выдачи',
                icon: 'pending_actions',
                requires: 'EduQueue:read',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'connectors',
              name: 'edubridge-admin-connectors',
              component: markRaw(AdminConnectorsPage),
              meta: {
                title: 'Площадки',
                icon: 'hub',
                requires: 'EduConnector:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'admins',
              name: 'edubridge-admin-admins',
              component: markRaw(AdminAdminsPage),
              meta: {
                title: 'Администраторы',
                icon: 'admin_panel_settings',
                requires: 'EduAdmin:manage',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
          ],
        },
      ],
    },
    {
      workspace: 'edubridge-member',
      extension_name: 'edubridge',
      title: 'Моё обучение',
      icon: 'family_restroom',
      defaultRoute: 'edubridge-learners',
      routes: [
        {
          meta: { title: 'Моё обучение', icon: 'family_restroom' },
          path: '/:coopname/edubridge-member',
          name: 'edubridge-member',
          children: [
            {
              path: 'onboarding',
              name: 'edubridge-member-onboarding',
              component: markRaw(MemberOnboardingPage),
              meta: {
                title: 'Подключение к обучению',
                icon: 'how_to_reg',
                requires: 'Onboarding:learner',
                gate: true,
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'learners',
              name: 'edubridge-learners',
              component: markRaw(MemberLearnersPage),
              meta: {
                title: 'Обучающиеся',
                icon: 'family_restroom',
                requires: 'EduLearner:read:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
          ],
        },
      ],
    },
    {
      workspace: 'edubridge-teacher',
      extension_name: 'edubridge',
      title: 'Преподавание',
      icon: 'co_present',
      defaultRoute: 'edubridge-assignments',
      routes: [
        {
          meta: { title: 'Преподавание', icon: 'co_present' },
          path: '/:coopname/edubridge-teacher',
          name: 'edubridge-teacher',
          children: [
            {
              path: 'onboarding',
              name: 'edubridge-teacher-onboarding',
              component: markRaw(TeacherOnboardingPage),
              meta: {
                title: 'Подключение к преподаванию',
                icon: 'how_to_reg',
                requires: 'Onboarding:teacher',
                gate: true,
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'assignments',
              name: 'edubridge-assignments',
              component: markRaw(TeacherAssignmentsPage),
              meta: {
                title: 'Назначения',
                icon: 'assignment',
                requires: 'EduAssignment:read:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'contributions',
              name: 'edubridge-contributions',
              component: markRaw(TeacherContributionsPage),
              meta: {
                title: 'Взносы результатами работы',
                icon: 'workspace_premium',
                requires: 'EduContribution:read:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
            {
              path: 'settlement',
              name: 'edubridge-settlement',
              component: markRaw(TeacherSettlementPage),
              meta: {
                title: 'Расчёт',
                icon: 'account_balance_wallet',
                requires: 'EduTeacherWallet:read:own',
                requiresAuth: true,
                agreements: agreementsBase,
              },
              children: [],
            },
          ],
        },
      ],
    },
  ];
}
