import { watch } from 'vue'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useBranchStore } from 'src/entities/Branch/model'
import { findChairedBranch } from 'src/entities/Branch/lib'
import { useSelectBranch } from 'src/features/Branch/SelectBranch/model'

export function useBranchOverlayProcess() {
  const session = useSessionStore()
  const system = useSystemStore()
  const branchStore = useBranchStore()
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
    // Председатель участка привязан к собственному участку и сменить его заявлением
    // не может — контракт такое заявление отклоняет. Если привязка при этом пуста
    // (например, его сняли с другого участка), оверлей стал бы неснимаемым экраном:
    // закрыть нельзя, а подписать не даст цепь.
    const isBranchChairman = !!findChairedBranch(branchStore.publicBranches, session.username)
    // до загрузки списка участков про председательство ничего не известно, а выбирать
    // всё равно не из чего — ждём список, чтобы оверлей не мигал председателю
    const branchesLoaded = branchStore.publicBranches.length > 0

    // показываем оверлей выбора КУ, если
    // пользователь - авторизован,
    // кооператив - в мажоритарном режиме (branched),
    // пользователь - это пайщик,
    // у пользователя не выбран КУ,
    // и он не председатель кооперативного участка
    isVisible.value = !!(
      session.isAuth &&
      branched &&
      isMine &&
      noBraname &&
      branchesLoaded &&
      !isBranchChairman
    )
  }

  checkConditions()

  watch(
    [() => session.isAuth, () => system.info, () => session.currentUserAccount, () => branchStore.publicBranches],
    checkConditions,
    { deep: true }
  )
}
