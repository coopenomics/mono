import { ref, watchEffect, type Ref } from 'vue'
import { Queries } from '@coopenomics/sdk'
import { Ledger2 } from 'cooptypes'
import { client } from 'src/shared/api/client'

/**
 * Баланс биллинг-кошелька пайщика (`w.wal.bill`) — того самого, куда
 * `billing::convert` зачисляет членский взнос и с которого оплачиваются
 * подписки провайдера.
 *
 * Читаем сырой срез `getUserWallets`, а не MAIN-кошелёк: MAIN сворачивает в
 * себя только паевой и членский (`w.wal.share` + `w.wal.member`), биллинга там
 * нет вовсе — из-за этого карточка подписок показывала ноль при живом балансе.
 *
 * coopname/username реактивны: смена → перезапрос.
 */
const unwrap = (v: Ref<string> | (() => string)) => (typeof v === 'function' ? v() : v.value)

const splitAsset = (asset?: string | null) => {
  if (!asset) return { amount: '0', symbol: '' }
  const [amount, sym = ''] = String(asset).split(' ')
  return { amount: amount || '0', symbol: sym }
}

export function useBillingWallet(
  coopname: Ref<string> | (() => string),
  username: Ref<string> | (() => string),
) {
  const loading = ref(false)
  // initialLoading — true только до первого ответа: тихие рефреши не должны
  // мигать плашкой «загрузка».
  const initialLoading = ref(true)
  const error = ref('')
  const available = ref('0')
  const symbol = ref('')

  const refresh = async (): Promise<void> => {
    const coop = unwrap(coopname)
    const user = unwrap(username)
    if (!coop || !user) return

    loading.value = true
    try {
      const { [Queries.Wallet.GetUserWallets.name]: wallets } = await client.Query(
        Queries.Wallet.GetUserWallets.query,
        { variables: { coopname: coop, username: user } },
      )
      // Кошелька может не быть вовсе (ни одного пополнения) — это ноль, не ошибка.
      const row = (wallets ?? []).find((w) => w.wallet_name === Ledger2.BILLING_WALLET_NAME)
      const parsed = splitAsset(row?.available)
      available.value = parsed.amount
      symbol.value = parsed.symbol
      error.value = ''
    } catch (e: unknown) {
      error.value = (e as Error)?.message ?? String(e)
    } finally {
      loading.value = false
      initialLoading.value = false
    }
  }

  watchEffect(() => {
    void refresh()
  })

  return { available, symbol, loading, initialLoading, error, refresh }
}
