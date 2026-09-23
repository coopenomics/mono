import layout from 'src/app/layouts/default.vue';
import widgetLayout from 'src/app/layouts/widget.vue';
import index from 'src/pages/index.vue';
import { BlankPage } from 'src/pages/Blank';
import { PermissionDenied } from 'src/pages/PermissionDenied';
import { SignUpPage } from 'src/pages/Registrator/SignUp';
import { CardcoopEntryPage } from 'src/pages/Registrator/CardcoopEntry';
import { SignInPage } from 'src/pages/Registrator/SignIn';
import { RouteRecordRaw } from 'vue-router';
import { InstallCooperativePage } from 'src/pages/Union/InstallCooperative';
import { LostKeyPage } from 'src/pages/Registrator/LostKey/ui';
import { ResetKeyPage } from 'src/pages/Registrator/ResetKey';
import { RecoverRequestPage, RecoverConfirmPage } from 'src/pages/Registrator/Recover/ui';
import { InvitePage } from 'src/pages/Registrator/Invite';
import { LoginRedirectPage } from 'src/features/User/LoginRedirect';
import { NotMePage } from 'src/pages/Security/NotMe';
import { PrivacyPage } from 'src/pages/Privacy';
import { TermsPage } from 'src/pages/Terms';
import { CoopidFlowPage } from 'src/pages/Registrator/CoopidFlow';
import { defineComponent, h } from 'vue';
import { t } from 'src/shared/i18n';

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
        // Экраны потоков CoopID (105-30): authentik ведёт, стол рисует. Адрес без coopname —
        // сюда возвращает nginx стенда с родного /if/flow/<slug>/, где coopname нет.
        path: 'flow/:slug',
        name: 'coopid-flow',
        component: CoopidFlowPage,
        children: [],
        meta: {
          authSplit: true,
          title: t('app.routes.login'),
          icon: 'login',
          requiresAuth: false,
          widget: {
            title: t('app.routes.login'),
            hideHeader: true,
            hideFooter: true,
          },
        },
      },
      {
        path: ':coopname/auth/signin',
        name: 'signin',
        component: SignInPage,
        children: [],
        meta: {
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.login'),
          icon: 'fa-solid fa-sign-in-alt',
          widget: {
            title: t('app.routes.login'),
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
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.keyRecovery'),
          icon: 'fa-solid fa-key',
          widget: {
            title: t('app.routes.keyRecovery'),
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
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.keyReset'),
          icon: 'fa-solid fa-key',
          widget: {
            title: t('app.routes.keyReset'),
            hideHeader: true,
          },
        },
      },
      {
        // Запрос восстановления доступа CoopID (magic-link на email) — Эпик 12, Story 12.3.
        path: ':coopname/auth/recover',
        name: 'recover',
        component: RecoverRequestPage,
        children: [],
        meta: {
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.accessRecovery'),
          icon: 'key',
          widget: {
            title: t('app.routes.accessRecovery'),
            hideHeader: true,
          },
        },
      },
      {
        // Landing one-click «Это не я» из письма о входе с нового устройства
        // (Story 3.10): без входа отзывает все сессии по одноразовому токену.
        path: ':coopname/security/not-me/:token',
        name: 'notMe',
        component: NotMePage,
        children: [],
        meta: {
          authSplit: true,
          title: t('app.routes.permissionDenied'),
          icon: 'security',
          widget: {
            title: t('app.routes.permissionDenied'),
            hideHeader: true,
          },
        },
      },
      {
        // Landing magic-link из письма: подтверждение смены ключа + новый пароль.
        path: ':coopname/auth/recover/:token',
        name: 'recoverConfirm',
        component: RecoverConfirmPage,
        children: [],
        meta: {
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.accessRecovery'),
          icon: 'key',
          widget: {
            title: t('app.routes.accessRecovery'),
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
          authSplit: true,
          title: t('app.routes.invitation'),
          icon: 'fa-solid fa-envelope',
          widget: {
            title: t('app.routes.invitation'),
            hideHeader: true,
          },
        },
      },
      {
        path: ':coopname/auth/cardcoop-entry',
        name: 'cardcoop-entry',
        component: CardcoopEntryPage,
        children: [],
        meta: {
          authSplit: true,
          title: t('app.routes.cardLogin'),
          icon: 'fa-solid fa-id-card',
          widget: {
            title: t('app.routes.cardLogin'),
            hideHeader: true,
            hideFooter: true,
          },
        },
      },
      {
        path: ':coopname/auth/signup',
        name: 'signup',
        component: SignUpPage,
        children: [],
        meta: {
          // Экран живёт в оболочке AuthSplit: без общей шапки и футера, панель до верха.
          authSplit: true,
          title: t('app.routes.registration'),
          icon: 'fa-solid fa-user-plus',
          widget: {
            title: t('app.routes.registration'),
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
          authSplit: true,
          layout: 'default',
          title: t('app.routes.contentAccessLogin'),
          icon: 'fa-solid fa-lock',
          roles: [],
          widget: {
            title: t('app.routes.contentAccessAuthorization'),
            hideHeader: false,
          },
        },
      },
      {
        path: '/privacy',
        name: 'privacy',
        component: PrivacyPage,
        meta: {
          title: t('app.routes.privacyPolicy'),
          icon: 'fa-solid fa-shield-alt',
        },
      },
      {
        path: '/terms',
        name: 'terms',
        component: TermsPage,
        meta: {
          title: t('app.routes.termsOfUse'),
          icon: 'fa-solid fa-file-contract',
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
    meta: { title: t('app.routes.devUiShowcase'), icon: 'fa-solid fa-flask' },
  });
}

// Считыватель удостоверений — отдельная страница для устройства проверяющего
// (планшет на входе), а не раздел кабинета. Намеренно не выведена ни в одно меню:
// пайщику она не нужна, а тому, кто проверяет, достаточно знать адрес.
baseRoutes.push({
  path: '/verify',
  name: 'verify-certificate',
  component: () => import('src/pages/Verify/VerifyCertificatePage.vue'),
  meta: { title: t('app.routes.verifyCertificate'), icon: 'verified_user' },
});

const rs = baseRoutes;

export { rs as routes };
