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
  //- Действие живёт под карточкой, а не внутри неё: WalletCard — законченная
  //- плитка канона, и врезать в неё кнопку значило бы верстать кошелёк руками.
  BaseButton.membership-wallet__action(
    variant="ghost"
    size="sm"
    type="button"
    @click="openConvert"
  )
    q-icon(name="sync_alt" size="14px").q-mr-xs
    | Конвертировать в членский

  ConvertToBillingDialog
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { BaseButton } from 'src/shared/ui/base'
import { WalletCard } from 'src/shared/ui/domain'
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import {
  ConvertToBillingDialog,
  useConvertToBillingVisibility,
} from 'src/features/Billing/ConvertToBilling'

const session = useSessionStore()
const system = useSystemStore()

const { membership, symbol, initialLoading, refresh } = useCooperativeMainWallet(
  () => system.info.coopname || '',
  () => session.username || '',
)

const fallbackSymbol = computed(
  () => system.info.symbols?.root_govern_symbol || 'RUB',
)

const balance = computed(() =>
  splitAsset2Digits(`${membership.value} ${symbol.value || fallbackSymbol.value}`),
)

const { isVisible } = useConvertToBillingVisibility()
const openConvert = () => {
  isVisible.value = true
}
watch(isVisible, (open, wasOpen) => {
  if (wasOpen && !open) void refresh()
})
</script>

<style scoped>
.membership-wallet {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2);
}
.membership-wallet__action {
  margin-left: calc(-1 * var(--p-2));
}
</style>
