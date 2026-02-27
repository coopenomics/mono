import { watch, ref } from 'vue'
import { useSessionStore } from 'src/entities/Session'
import { useHeaderActions } from 'src/shared/hooks'
import { ShareHeaderAction } from 'src/features/PageShare'

/**
 * Регистрирует кнопку "Поделиться" в header на всех страницах.
 * Доступна для chairman и member.
 * Вызывается из init-app после инициализации router.
 */
export function useShareButtonProcess() {
  const session = useSessionStore()
  const { registerAction, unregisterAction } = useHeaderActions()

  const updateShareButton = () => {
    const canShare = (session.isChairman || session.isMember) && session.isAuth

    if (canShare) {
      registerAction({
        id: 'page-share',
        component: ShareHeaderAction,
        order: 100,
      })
    } else {
      unregisterAction('page-share')
    }
  }

  // Обновляем при изменении auth
  watch(() => session.isAuth, updateShareButton, { immediate: true })
}
