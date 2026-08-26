<template lang="pug">
.membership-wallet
  WalletCard(
    program="wallet"
    title="Членские взносы"
    subtitle="Оплата подписок кооператива"
    :balance="balance.amount"
    :symbol="balance.symbol || fallbackSymbol"
    :loading="initialLoading"
  )
    //- Пополнение технически и есть трансляция паевого взноса в членский
    //- (ConvertToBillingDialog), но пайщику это действие известно как
    //- «пополнить»; заливкой — потому что при нулевом остатке подписки списать
    //- нечем, и это главное действие карточки.
    template(#actions)
      BaseButton(
        variant="primary"
        size="md"
        type="button"
        @click="openConvert"
      )
        q-icon(name="add" size="16px").q-mr-xs
        | Пополнить

  ConvertToBillingDialog
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { BaseButton } from 'src/shared/ui/base'
import { WalletCard } from 'src/shared/ui/domain'
import { useBillingWallet } from 'src/entities/Wallet/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import {
  ConvertToBillingDialog,
  useConvertToBillingVisibility,
} from 'src/features/Billing/ConvertToBilling'

const session = useSessionStore()
const system = useSystemStore()

// Показываем биллинг-кошелёк (`w.wal.bill`) — именно на него ложится
// пополнение и с него провайдер списывает подписки. MAIN-кошелёк для этого не
// годится: он сворачивает только паевой и членский, биллинга в нём нет.
const { available, symbol, initialLoading, refresh } = useBillingWallet(
  () => system.info.coopname || '',
  () => session.username || '',
)

const fallbackSymbol = computed(
  () => system.info.symbols?.root_govern_symbol || 'RUB',
)

const balance = computed(() =>
  splitAsset2Digits(`${available.value} ${symbol.value || fallbackSymbol.value}`),
)

const { isVisible } = useConvertToBillingVisibility()
const openConvert = () => {
  isVisible.value = true
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * После пополнения баланс в цепи меняется не мгновенно для интерфейса: между
 * транзакцией и появлением дельты в кеше бэкенда проходит около трёх секунд.
 * Поэтому обновляемся не один раз, а несколькими попытками с паузами и
 * останавливаемся, как только сумма изменилась. Тихо, без лоадера поверх
 * экрана: карточка просто дорисует новое число.
 */
const refreshAfterConvert = async (): Promise<void> => {
  const before = available.value
  for (const delay of [1500, 3000, 5000]) {
    await sleep(delay)
    await refresh()
    if (available.value !== before) return
  }
}

watch(isVisible, (open, wasOpen) => {
  if (wasOpen && !open) void refreshAfterConvert()
})
</script>

<style scoped>
/* Обёртка нужна только чтобы рядом с карточкой жил диалог конвертации —
   собственной геометрии у неё нет, ширину задаёт колонка сетки. */
.membership-wallet {
  display: contents;
}
</style>
