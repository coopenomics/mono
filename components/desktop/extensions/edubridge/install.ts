import { markRaw, type Component } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig, IWorkspaceRoute, IWorkspaceRouteMeta } from 'src/shared/lib/types/workspace';
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
 * права, фронт сверяет `meta.requires`. Гость получает `EduCatalog:read` после
 * подключения ЦПП советом — до этого столов нет ни у кого, кроме председателя
 * (`Extension:configure`). Страницы с `gate: true` — шлюзы онбординга:
 * показываются, пока не подписана соответствующая оферта.
 *
 *   edubridge          — «Обучение»: каталог (гость/все), курсы и настройка (владелец/администратор)
 *   edubridge-member   — «Моё обучение»: обучающиеся, подписки, доступ (родитель-слушатель)
 *   edubridge-teacher  — «Преподавание»: назначения, взносы РИД (преподаватель)
 */
/** Что страница объявляет о себе: подпись, иконка и право стола; шлюз и скрытость — по месту. */
type PageMeta = Pick<IWorkspaceRouteMeta, 'title' | 'icon' | 'requires' | 'gate' | 'hidden'> & { requires: string };

/** Страница для гостя: без входа и соглашений. */
function publicPage(path: string, name: string, component: Component, meta: PageMeta & IWorkspaceRouteMeta): IWorkspaceRoute {
  return { path, name, component: markRaw(component), meta, children: [] };
}

/** Страница пайщика: вход и базовые соглашения обязательны. */
function memberPage(path: string, name: string, component: Component, meta: PageMeta): IWorkspaceRoute {
  return publicPage(path, name, component, { ...meta, requiresAuth: true, agreements: agreementsBase });
}

function workspace(name: string, title: string, icon: string, defaultRoute: string, children: IWorkspaceRoute[]): IWorkspaceConfig {
  return {
    workspace: name,
    extension_name: 'edubridge',
    title,
    icon,
    defaultRoute,
    routes: [{ meta: { title, icon }, path: `/:coopname/${name}`, name, children }],
  };
}

/** «Обучение»: каталог (после подключения ЦПП — всем), курсы и настройка (владелец/администратор). */
function learningWorkspace(): IWorkspaceConfig {
  return workspace('edubridge', 'Обучение', 'school', 'edubridge-catalog', [
    publicPage('catalog', 'edubridge-catalog', CatalogPage, { title: 'Каталог курсов', icon: 'school', requires: 'EduCatalog:read' }),
    publicPage('catalog/:id', 'edubridge-catalog-course', CourseCardPage, { title: 'Курс', icon: 'school', requires: 'EduCatalog:read', hidden: true }),
    memberPage('configure', 'edubridge-configure', ConfigurePage, { title: 'Подключение', icon: 'settings', requires: 'Extension:configure', gate: true }),
    memberPage('courses', 'edubridge-admin-courses', AdminCoursesPage, { title: 'Курсы', icon: 'library_books', requires: 'EduCourse:manage' }),
    memberPage('assignments', 'edubridge-admin-assignments', AdminAssignmentsPage, { title: 'Преподаватели', icon: 'assignment_ind', requires: 'EduAssignment:manage' }),
    memberPage('registry', 'edubridge-admin-registry', AdminMembersPage, { title: 'Реестр пайщиков', icon: 'groups', requires: 'EduRegistry:read' }),
    memberPage('queue', 'edubridge-admin-queue', AdminQueuePage, { title: 'Очередь выдачи', icon: 'pending_actions', requires: 'EduQueue:read' }),
    memberPage('connectors', 'edubridge-admin-connectors', AdminConnectorsPage, { title: 'Площадки', icon: 'hub', requires: 'EduConnector:manage' }),
    memberPage('admins', 'edubridge-admin-admins', AdminAdminsPage, { title: 'Администраторы', icon: 'admin_panel_settings', requires: 'EduAdmin:manage' }),
  ]);
}

/** «Моё обучение»: обучающиеся, подписки, доступ (родитель-слушатель). */
function memberWorkspace(): IWorkspaceConfig {
  return workspace('edubridge-member', 'Моё обучение', 'family_restroom', 'edubridge-learners', [
    memberPage('onboarding', 'edubridge-member-onboarding', MemberOnboardingPage, { title: 'Подключение к обучению', icon: 'how_to_reg', requires: 'Onboarding:learner', gate: true }),
    memberPage('learners', 'edubridge-learners', MemberLearnersPage, { title: 'Обучающиеся', icon: 'family_restroom', requires: 'EduLearner:read:own' }),
  ]);
}

/** «Преподавание»: назначения, взносы РИД, расчёт (преподаватель). */
function teacherWorkspace(): IWorkspaceConfig {
  return workspace('edubridge-teacher', 'Преподавание', 'co_present', 'edubridge-assignments', [
    memberPage('onboarding', 'edubridge-teacher-onboarding', TeacherOnboardingPage, { title: 'Подключение к преподаванию', icon: 'how_to_reg', requires: 'Onboarding:teacher', gate: true }),
    memberPage('assignments', 'edubridge-assignments', TeacherAssignmentsPage, { title: 'Назначения', icon: 'assignment', requires: 'EduAssignment:read:own' }),
    memberPage('contributions', 'edubridge-contributions', TeacherContributionsPage, { title: 'Взносы результатами работы', icon: 'workspace_premium', requires: 'EduContribution:read:own' }),
    memberPage('settlement', 'edubridge-settlement', TeacherSettlementPage, { title: 'Расчёт', icon: 'account_balance_wallet', requires: 'EduTeacherWallet:read:own' }),
  ]);
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [learningWorkspace(), memberWorkspace(), teacherWorkspace()];
}
