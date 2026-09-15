import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';

/**
 * «На главную» со страниц-состояний (404, нет прав). Вошедшего пайщика ведёт на
 * стол участника — он открыт всем; остальных — на страницу по умолчанию
 * текущего стола. Одна точка, чтобы обе страницы вели себя одинаково.
 */
export function useGoHome(): () => void {
  const router = useRouter();
  const desktops = useDesktopStore();
  const session = useSessionStore();

  return () => {
    if (session.isAuth && session.isRegistrationComplete) {
      const hasParticipant = desktops.currentDesktop?.workspaces.some((ws) => ws.name === 'participant');
      if (hasParticipant) {
        desktops.selectWorkspace('participant');
        desktops.goToDefaultPage(router);
        return;
      }
    }
    desktops.goToDefaultPage(router);
  };
}
