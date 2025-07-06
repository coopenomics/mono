import { Router } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useCurrentUser } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { LocalStorage } from 'quasar';

function hasAccess(to, userRole) {
  if (!to.meta?.roles || to.meta?.roles.length === 0) return true;
  return userRole && to.meta?.roles.includes(userRole);
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

  const { info } = useSystemStore();

  router.beforeEach(async (to, from, next) => {
    await desktops.healthCheck();
    const currentUser = useCurrentUser();
    // если требуется установка
    if (desktops.health?.status === 'install' && to.name !== 'install') {
      next({ name: 'install', params: { coopname: info.coopname } });
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
        console.warn('User data loading timeout');
      }
    }

    // Определяем роль пользователя при каждом запросе
    let userRole: string | null = null;
    if (session.isAuth) {
      if (currentUser.isChairman) {
        userRole = 'chairman';
      } else if (currentUser.isMember) {
        userRole = 'member';
      } else {
        userRole = 'user'; // Авторизованный пользователь без специальной роли
      }
    }

    // редирект с index
    if (to.name === 'index') {
      // Убеждаемся, что правильный рабочий стол выбран
      if (session.isAuth && currentUser.isRegistrationComplete.value) {
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
        // Если пользователь не авторизован, используем nonAuthorizedHome
        const homePage = desktops.currentDesktop?.nonAuthorizedHome;
        next({ name: homePage, params: { coopname: info.coopname } });
        return;
      }
    }

    // Проверка авторизации для маршрутов, требующих входа
    if (to.meta?.requiresAuth && !session.isAuth) {
      // Сохраняем целевой URL для редиректа после входа
      if (process.env.CLIENT) {
        // Получаем URL для редиректа
        const redirectUrl = getRedirectUrl(router, to);
        LocalStorage.set('redirectAfterLogin', redirectUrl);
      }
      // Перенаправляем на страницу входа
      next({ name: 'login-redirect', params: { coopname: info.coopname } });
      return;
    }

    // проверка по ролям
    if (hasAccess(to, userRole)) {
      next();
    } else {
      next({ name: 'permissionDenied' });
    }
  });
}
