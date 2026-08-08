import { watch } from 'vue'
import { useAccountStore } from 'src/entities/Account/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useSelectBranch } from 'src/features/Branch/SelectBranch/model'

export function useBranchOverlayProcess() {
  const session = useSessionStore()
  const system = useSystemStore()
  const account = useAccountStore()
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
    const participant = account?.account?.participant_account
    const noBraname = participant?.braname === ''

    // показываем оверлей выбора КУ, если
    // пользователь - авторизован,
    // кооператив - в мажоритарном режиме (branched),
    // пользователь - это пайщик,
    // и у пользователя не выбран КУ
    isVisible.value = !!(
      session.isAuth &&
      branched &&
      participant &&
      noBraname
    )
  }

  checkConditions()

  watch(
    [() => session.isAuth, () => system.info, () => account.account],
    checkConditions,
    { deep: true }
  )
}
