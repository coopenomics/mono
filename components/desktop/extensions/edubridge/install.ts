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
  MemberSubscriptionsPage,
  TeacherAssignmentsPage,
  TeacherContributionsPage,
  TeacherOnboardingPage,
  TeacherSettlementPage,
} from './pages';

/**
 * Столы «Образовательного моста» — три, как в PRD (границы продукта):
 *
 *   edubridge          — «Стол администратора»: владелец и администратор в одном
 *                        рабочем месте; часть страниц шире у владельца (площадки,
 *                        администраторы, подключение). Курсы, преподаватели, реестр
 *                        пайщиков, очередь выдачи.
 *   edubridge-member   — «Стол ученика»: каталог курсов (открыт гостю после
 *                        подключения ЦПП советом — витрина до вступления, как каталог
 *                        в «Столе заказчика»), обучающиеся и отдельно подписки.
 *   edubridge-teacher  — «Стол преподавателя»: назначения, взносы результатами
 *                        работы, расчёт.
 *
 * Имена workspace обязаны посимвольно совпадать с `AppRegistry['edubridge'].desktops`
 * в controller — иначе маршруты молча теряются. Видимость — канон грантов: backend
 * (EdubridgeDesktopGrantsProvider) выдаёт права, фронт сверяет `meta.requires`.
 * Страницы с `gate: true` — шлюзы онбординга: показываются, пока не подписаны
 * оферта (и договор УХД у преподавателя).
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

/** «Стол администратора»: владелец и администратор; каталог здесь не нужен — он в столе ученика. */
function adminWorkspace(): IWorkspaceConfig {
  return workspace('edubridge', 'Стол администратора', 'admin_panel_settings', 'edubridge-admin-courses', [
    memberPage('configure', 'edubridge-configure', ConfigurePage, { title: 'Подключение', icon: 'settings', requires: 'Extension:configure', gate: true }),
    memberPage('courses', 'edubridge-admin-courses', AdminCoursesPage, { title: 'Курсы', icon: 'library_books', requires: 'EduCourse:manage' }),
    memberPage('teachers', 'edubridge-admin-assignments', AdminAssignmentsPage, { title: 'Преподаватели', icon: 'co_present', requires: 'EduAssignment:manage' }),
    memberPage('members', 'edubridge-admin-registry', AdminMembersPage, { title: 'Реестр пайщиков', icon: 'groups', requires: 'EduRegistry:read' }),
    memberPage('queue', 'edubridge-admin-queue', AdminQueuePage, { title: 'Очередь выдачи', icon: 'pending_actions', requires: 'EduQueue:read' }),
    memberPage('platforms', 'edubridge-admin-connectors', AdminConnectorsPage, { title: 'Площадки', icon: 'hub', requires: 'EduConnector:manage' }),
    memberPage('admins', 'edubridge-admin-admins', AdminAdminsPage, { title: 'Администраторы', icon: 'admin_panel_settings', requires: 'EduAdmin:manage' }),
  ]);
}

/** «Стол ученика»: каталог (гостю — витрина), обучающиеся, подписки. Подписка
    оформляется в карточке курса, поэтому кнопок «получить доступ» на столе нет. */
function parentWorkspace(): IWorkspaceConfig {
  return workspace('edubridge-member', 'Стол ученика', 'family_restroom', 'edubridge-catalog', [
    publicPage('catalog', 'edubridge-catalog', CatalogPage, { title: 'Каталог курсов', icon: 'school', requires: 'EduCatalog:read' }),
    publicPage('catalog/:id', 'edubridge-catalog-course', CourseCardPage, { title: 'Курс', icon: 'school', requires: 'EduCatalog:read', hidden: true }),
    memberPage('onboarding', 'edubridge-member-onboarding', MemberOnboardingPage, { title: 'Подключение', icon: 'how_to_reg', requires: 'Onboarding:learner', gate: true }),
    memberPage('learners', 'edubridge-learners', MemberLearnersPage, { title: 'Обучающиеся', icon: 'family_restroom', requires: 'EduLearner:read:own' }),
    memberPage('subscriptions', 'edubridge-subscriptions', MemberSubscriptionsPage, { title: 'Мои подписки', icon: 'card_membership', requires: 'EduEnrollment:read:own' }),
  ]);
}

/** «Стол преподавателя»: назначения, взносы результатами работы, расчёт. */
function teacherWorkspace(): IWorkspaceConfig {
  return workspace('edubridge-teacher', 'Стол преподавателя', 'co_present', 'edubridge-assignments', [
    memberPage('onboarding', 'edubridge-teacher-onboarding', TeacherOnboardingPage, { title: 'Подключение', icon: 'how_to_reg', requires: 'Onboarding:teacher', gate: true }),
    memberPage('assignments', 'edubridge-assignments', TeacherAssignmentsPage, { title: 'Назначения', icon: 'assignment', requires: 'EduAssignment:read:own' }),
    memberPage('contributions', 'edubridge-contributions', TeacherContributionsPage, { title: 'Взносы результатами работы', icon: 'workspace_premium', requires: 'EduContribution:read:own' }),
    memberPage('settlement', 'edubridge-settlement', TeacherSettlementPage, { title: 'Расчёт', icon: 'account_balance_wallet', requires: 'EduTeacherWallet:read:own' }),
  ]);
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [adminWorkspace(), parentWorkspace(), teacherWorkspace()];
}
