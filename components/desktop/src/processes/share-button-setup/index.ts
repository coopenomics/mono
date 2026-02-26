import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from 'src/entities/Session'
import { useHeaderActions } from 'src/shared/hooks'
import { ShareHeaderAction } from 'src/features/PageShare'

export function useShareButtonProcess() {
  let route: ReturnType<typeof useRoute> | undefined
  try {
    route = useRoute()
  } catch {
    return
  }
  if (!route) return

  const session = useSessionStore()
  const { registerAction, unregisterAction } = useHeaderActions()

  watch(
    () => route?.fullPath,
    () => {
      if (!route) return
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
