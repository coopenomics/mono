import { Router } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { LocalStorage } from 'quasar';
import { Zeus } from '@coopenomics/sdk';

function hasAccess(to, userRole) {
  if (!to.meta?.roles || to.meta?.roles.length === 0) return true;
  return userRole && to.meta?.roles.includes(userRole);
}

function hasShareToken(to): boolean {
  return !!(to.query?.share_token && typeof to.query.share_token === 'string' && to.query.share_token.length > 10);
}

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
    if ((systemStore.info.system_status === Zeus.SystemStatus.install || systemStore.info.system_status === Zeus.SystemStatus.initialized) && !allowedRoutesDuringInstall.includes(to.name as string)) {
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

    // Определяем роль пользователя при каждом запросе
    let userRole: string | null = null;
    if (session.isAuth) {
      if (session.isChairman) {
        userRole = 'chairman';
      } else if (session.isMember) {
        userRole = 'member';
      } else {
        userRole = 'user'; // Авторизованный пользователь без специальной роли
      }
    }

    // редирект с index
    if (to.name === 'index') {
      // Убеждаемся, что правильный рабочий стол выбран
      if (session.isAuth && session.isRegistrationComplete) {
        // Если рабочий стол не выбран - выбираем по правам пользователя
        if (!desktops.activeWorkspaceName) {
          desktops.selectDefaultWorkspace();
        }

        // Получаем данные маршрута по умолчанию для выбранного рабочего стола
        const defaultPageRoute = desktops.getDefaultPageRoute();
        if (defaultPageRoute) {
          next(defaultPageRoute);
        } else {
          // Если не удалось определить маршрут, используем fallback
          next({ name: 'somethingBad' });
        }
        return;
      } else {
        // Если пользователь не авторизован, выбираем рабочий стол и переходим на страницу по умолчанию
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

    // проверка по ролям — при наличии share_token пропускаем проверку ролей
    if (hasAccess(to, userRole) || hasShareToken(to)) {
      next();
    } else {
      next({ name: 'permissionDenied', query: to.query });
    }
  });
}
