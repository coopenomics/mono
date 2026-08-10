import { watch } from 'vue'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useSelectBranch } from 'src/features/Branch/SelectBranch/model'

export function useBranchOverlayProcess() {
  const session = useSessionStore()
  const system = useSystemStore()
  const { isVisible } = useSelectBranch()

  const checkConditions = () => {
    // Harness/docs escape hatch: позволяет снимать скриншоты разделов
    // без прохождения процедуры выбора кооп. участка. Включается через
    // `localStorage.setItem('harness:noBranchOverlay', '1')` перед навигацией.
    if (typeof window !== 'undefined' && window.localStorage?.getItem('harness:noBranchOverlay') === '1') {
      isVisible.value = false
      return
    }

    const branched = system.info?.cooperator_account?.is_branched
    // Только собственный аккаунт: его держит сессия (init-wallet и логин).
    // Общий слот accountStore.account перетирается любым чтением чужого
    // аккаунта (реестры, журналы операций), и гейт принимал чужого пайщика
    // без участка за текущего пользователя.
    const participant = session.currentUserAccount?.participant_account
    const isMine = !!participant && participant.username === session.username
    const noBraname = participant?.braname === ''

    // показываем оверлей выбора КУ, если
    // пользователь - авторизован,
    // кооператив - в мажоритарном режиме (branched),
    // пользователь - это пайщик,
    // и у пользователя не выбран КУ
    isVisible.value = !!(
      session.isAuth &&
      branched &&
      isMine &&
      noBraname
    )
  }

  checkConditions()

  watch(
    [() => session.isAuth, () => system.info, () => session.currentUserAccount],
    checkConditions,
    { deep: true }
  )
}
