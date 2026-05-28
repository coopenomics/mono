import layout from 'src/app/layouts/default.vue';
import widgetLayout from 'src/app/layouts/widget.vue';
import index from 'src/pages/index.vue';
import { BlankPage } from 'src/pages/Blank';
import { PermissionDenied } from 'src/pages/PermissionDenied';
import { SignUpPage } from 'src/pages/Registrator/SignUp';
import { SignInPage } from 'src/pages/Registrator/SignIn';
import { RouteRecordRaw } from 'vue-router';
import { InstallCooperativePage } from 'src/pages/Union/InstallCooperative';
import { LostKeyPage } from 'src/pages/Registrator/LostKey/ui';
import { ResetKeyPage } from 'src/pages/Registrator/ResetKey';
import { InvitePage } from 'src/pages/Registrator/Invite';
import { LoginRedirectPage } from 'src/features/User/LoginRedirect';
import { PrivacyPage } from 'src/pages/Privacy';
import { defineComponent, h } from 'vue';

// Dynamic layout wrapper, который определяет layout в runtime
const DynamicLayoutWrapper = defineComponent({
  name: 'DynamicLayoutWrapper',
  setup() {
    // Проверяем widget режим только на клиенте
    const isWidgetMode =
      typeof window !== 'undefined' &&
      (window.parent !== window ||
        new URLSearchParams(window.location.search).get('widget') === 'true');

    return () => {
      const LayoutComponent = isWidgetMode ? widgetLayout : layout;
      return h(LayoutComponent);
    };
  },
});

const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DynamicLayoutWrapper,
    name: 'base',
    children: [
      {
        path: '',
        name: 'index',
        component: index,
      },
      {
        path: '/something-bad',
        name: 'somethingBad',
        component: BlankPage,
      },
      {
        path: '/permission-denied',
        name: 'permissionDenied',
        component: PermissionDenied,
      },
      {
        path: ':coopname/auth/signin',
        name: 'signin',
        component: SignInPage,
        children: [],
        meta: {
          title: 'Вход',
          icon: 'fa-solid fa-sign-in-alt',
          widget: {
            title: 'Вход',
            hideHeader: true,
            hideFooter: true,
          },
        },
      },
      {
        path: ':coopname/auth/lost-key',
        name: 'lostkey',
        component: LostKeyPage,
        children: [],
        meta: {
          title: 'Восстановление ключа',
          icon: 'fa-solid fa-key',
          widget: {
            title: 'Восстановление ключа',
            hideHeader: true,
          },
        },
      },
      {
        path: ':coopname/auth/reset-key',
        name: 'resetkey',
        component: ResetKeyPage,
        children: [],
        meta: {
          title: 'Сброс ключа',
          icon: 'fa-solid fa-key',
          widget: {
            title: 'Сброс ключа',
            hideHeader: true,
          },
        },
      },
      {
        path: ':coopname/auth/invite',
        name: 'invite',
        component: InvitePage,
        children: [],
        meta: {
          title: 'Приглашение',
          icon: 'fa-solid fa-envelope',
          widget: {
            title: 'Приглашение',
            hideHeader: true,
          },
        },
      },
      {
        path: ':coopname/auth/signup',
        name: 'signup',
        component: SignUpPage,
        children: [],
        meta: {
          title: 'Регистрация',
          icon: 'fa-solid fa-user-plus',
          widget: {
            title: 'Регистрация',
            hideHeader: true,
            hideFooter: true,
          },
        },
      },
      {
        path: ':coopname/auth/login-redirect',
        name: 'login-redirect',
        component: LoginRedirectPage,
        meta: {
          layout: 'default',
          title: 'Вход для доступа к содержимому',
          icon: 'fa-solid fa-lock',
          roles: [],
          widget: {
            title: 'Авторизация',
            hideHeader: false,
          },
        },
      },
      {
        path: '/privacy',
        name: 'privacy',
        component: PrivacyPage,
        meta: {
          title: 'Политика конфиденциальности',
          icon: 'fa-solid fa-shield-alt',
        },
      },
      {
        path: ':coopname/install',
        name: 'install',
        component: InstallCooperativePage,
        children: [],
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: BlankPage,
      },
    ],
  },
];

// MONO Platform v2 — dev-only showcase route at /_dev/ui.
// Монтируется на корневом уровне, ВНЕ DynamicLayoutWrapper: legacy default.vue
// рисует QDrawer/QHeader с собственными цветами и градиентами — он бы перекрыл
// чистый canon-канвас витрины базовых компонентов.
if (process.env.DEV) {
  baseRoutes.push({
    path: '/_dev/ui',
    name: 'dev-ui-showcase',
    component: () => import('src/pages/_dev/ui/index.vue'),
    meta: { title: 'MONO v2 — базовые компоненты', icon: 'fa-solid fa-flask' },
  });
}

const rs = baseRoutes;

export { rs as routes };
