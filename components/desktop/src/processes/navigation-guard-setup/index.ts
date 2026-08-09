import { Router } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { LocalStorage } from 'quasar';
import { Zeus } from '@coopenomics/sdk';

// Функция для получения URL для редиректа
function getRedirectUrl(router: Router, to: any): string {
  if (process.env.CLIENT) {
    return router.resolve(to).href;
  }
  return '';
}

export function setupNavigationGuard(router: Router) {
  const desktops = useDesktopStore();
  const session = useSessionStore();
  const systemStore = useSystemStore();

  router.beforeEach(async (to, from, next) => {
    // если требуется установка
    const allowedRoutesDuringInstall = ['install', 'invite'];
    const isIncompleteInstallMaintenance =
      systemStore.info.system_status === Zeus.SystemStatus.maintenance &&
      !systemStore.info.vars?.name;
    const requiresInstallFlow =
      systemStore.info.system_status === Zeus.SystemStatus.install ||
      systemStore.info.system_status === Zeus.SystemStatus.initialized ||
      isIncompleteInstallMaintenance;

    if (requiresInstallFlow && !allowedRoutesDuringInstall.includes(to.name as string)) {
      next({ name: 'install', params: { coopname: systemStore.info.coopname }, query: to.query });
      return;
    }
    // Если пользователь авторизован, но данные еще не загружены полностью
    if (session.isAuth && !session.loadComplete) {
      console.log('Waiting for user data to load...');

      // Ждем завершения загрузки данных пользователя
      let attempts = 0;
      const maxAttempts = 50; // 5 секунд максимум

      while (!session.loadComplete && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        session.loadComplete = true;
        console.warn('User data loading timeout');
      }
    }

    // редирект с index
    if (to.name === 'index') {
      // Только пайщики со status='active' попадают на свой дашборд.
      // На промежуточных статусах (created/joined/payed/registered) и
      // неавторизованных — публичная главная (non_authorized_default_*).
      // Юзера не редиректим насильно: с публичной главной он сам решает
      // продолжить регистрацию (/auth/signup) или войти под другим ключом.
      if (session.isFullyActive) {
        if (!desktops.activeWorkspaceName) {
          desktops.selectDefaultWorkspace();
        }

        const defaultPageRoute = desktops.getDefaultPageRoute();
        if (defaultPageRoute) {
          next(defaultPageRoute);
        } else {
          next({ name: 'somethingBad' });
        }
        return;
      } else {
        desktops.selectDefaultWorkspace();
        const defaultRoute = desktops.getDefaultPageRoute();
        if (defaultRoute) {
          next(defaultRoute);
        } else {
          next({ name: 'signup', params: { coopname: systemStore.info.coopname }, query: to.query });
        }
        return;
      }
    }

    // Проверка авторизации для маршрутов, требующих входа
    if (to.meta?.requiresAuth && !session.isAuth) {
      // Сохраняем целевой URL для редиректа после входа
      if (process.env.CLIENT) {
        // Получаем URL для редиректа
        console.log('требуем аудентификацию ', to)
        const redirectUrl = getRedirectUrl(router, to);
        LocalStorage.set('redirectAfterLogin', redirectUrl);
      }
      // Перенаправляем на страницу входа
      next({ name: 'login-redirect', params: { coopname: systemStore.info.coopname } });
      return;
    }

    // Пайщик с WIF, но советом ещё не принят (status != active):
    // защищённые маршруты (дашборд, кошелёк, оферты) ему не показываем,
    // отправляем на публичную главную. Регистрационный путь /auth/*
    // и публичные страницы остаются доступны (он сам выберет «продолжить»).
    if (
      to.meta?.requiresAuth &&
      session.isAuth &&
      !session.isFullyActive &&
      !(typeof to.path === 'string' && to.path.includes('/auth/'))
    ) {
      next({ name: 'index', params: { coopname: systemStore.info.coopname }, query: to.query });
      return;
    }

    // Проверка доступа к маршруту: канон авторизации столов (grants).
    // Стор сам решает — grant-стол (по `meta.requires` против выданных бэкендом
    // прав) или legacy (по `meta.roles`). Настоящий enforcement — на резолверах.
    if (desktops.hasRouteAccess(to.matched.map((r) => r.name ?? null), to.meta)) {
      next();
    } else {
      next({ name: 'permissionDenied', query: to.query });
    }
  });

  // Синхронизация активного рабочего стола с маршрутом после КАЖДОГО успешного
  // перехода: прямой заход по URL и переход кнопкой со стола А на маршрут стола Б
  // больше не оставляют активным «не тот» стол (см. DesktopStore). Только меняет
  // состояние — навигацию afterEach не инициирует, цикла не будет.
  router.afterEach((to) => {
    desktops.syncActiveWorkspaceFromRoute(to.matched.map((r) => r.name ?? null));
  });
}
