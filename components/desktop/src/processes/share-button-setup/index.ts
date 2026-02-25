import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import { useHeaderActions } from 'src/shared/hooks'
import { ShareHeaderAction } from 'src/features/PageShare'

/**
 * Автоматически регистрирует кнопку "Поделиться" в header
 * на страницах где meta.shareable === true.
 * Доступна только chairman и member.
 */
export function useShareButtonProcess() {
  const route = useRoute()
  const session = useSessionStore()
  const { registerAction, unregisterAction } = useHeaderActions()

  watch(
    () => route.fullPath,
    () => {
      const canShare = session.isChairman || session.isMember
      const isShareable = route.meta?.shareable !== false

      if (canShare && isShareable && session.isAuth) {
        registerAction({
          id: 'page-share',
          component: ShareHeaderAction,
          order: 100,
        })
      } else {
        unregisterAction('page-share')
      }
    },
    { immediate: true },
  )
}
