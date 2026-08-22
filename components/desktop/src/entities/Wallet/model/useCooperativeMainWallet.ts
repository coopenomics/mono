import { ref, watchEffect, type Ref } from 'vue'
import { Queries, Zeus } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'

/**
 * Балансы MAIN-программы (split-кошелёк): `available` — паевой взнос
 * (w.wal.share), `membership_contribution` — кошелёк членских/инфраструктурных
 * взносов (w.wal.member/w.wal.bill). Backend отдаёт оба поля одной записью
 * MAIN-программы, отдельных запросов для каждого waltype не требуется.
 *
 * coopname/username реактивны: смена → перезапрос.
 */
const splitAsset = (asset?: string | null) => {
  if (!asset) return { amount: '0', symbol: '' }
  const [amount, sym = ''] = String(asset).split(' ')
  return { amount: amount || '0', symbol: sym }
}

export function useCooperativeMainWallet(
  coopname: Ref<string> | (() => string),
  username: Ref<string> | (() => string),
) {
  const loading = ref(false)
  // initialLoading — true ТОЛЬКО до первого успешного ответа. UI должен
  // ориентироваться на него (а не на loading), иначе при тихих рефрешах
  // (закрытие диалога конвертации, реактивная смена coopname в две фазы)
  // плашка моргает «загрузка → значение → загрузка → значение».
  const initialLoading = ref(true)
  const error = ref('')
  const available = ref('0')
  const membership = ref('0')
  const symbol = ref('')

  const getCoopname = () =>
    typeof coopname === 'function' ? coopname() : coopname.value
  const getUsername = () =>
    typeof username === 'function' ? username() : username.value

  const applyWallet = (wallet?: { available?: string | null; membership_contribution?: string | null } | null) => {
    const av = splitAsset(wallet?.available)
    const mb = splitAsset(wallet?.membership_contribution)
    available.value = av.amount
    membership.value = mb.amount
    symbol.value = av.symbol || mb.symbol
  }

  // У пайщика может ещё не быть MAIN-кошелька (новый coop) —
  // показываем нули, а не ошибку.
  const applyError = (e: unknown) => {
    const msg = (e as any)?.message ?? String(e)
    if (/not found|null/i.test(msg)) {
      applyWallet(null)
    } else {
      error.value = msg
    }
  }

  let inFlight = 0
  let lastKey = ''

  const refresh = async () => {
    const c = getCoopname()
    const u = getUsername()
    if (!c || !u) return
    // Дедуп параллельных вызовов: если уже летит запрос на тот же ключ — пропустить.
    const key = `${c}/${u}`
    if (inFlight > 0 && lastKey === key) return
    lastKey = key
    inFlight++
    loading.value = true
    error.value = ''
    try {
      const { [Queries.Wallet.GetProgramWallet.name]: wallet } = await client.Query(
        Queries.Wallet.GetProgramWallet.query,
        {
          variables: {
            filter: {
              coopname: c,
              username: u,
              program_type: Zeus.ProgramType.MAIN,
            },
          },
        },
      )
      applyWallet(wallet)
    } catch (e: unknown) {
      applyError(e)
    } finally {
      inFlight = Math.max(0, inFlight - 1)
      loading.value = false
      initialLoading.value = false
    }
  }

  watchEffect(() => {
    void getCoopname()
    void getUsername()
    void refresh()
  })

  return { available, membership, symbol, loading, initialLoading, error, refresh }
}
