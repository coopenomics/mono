<template lang="pug">
.membership-wallet
  BaseCard(
    title="Кошелёк членских взносов"
    subtitle="Списывается за инфраструктурные подписки кооператива у провайдера. Пополняется конвертацией паевого взноса."
  )
    .membership-wallet__metric
      .membership-wallet__metric-label Доступно
      .membership-wallet__metric-value.t-mono(v-if="initialLoading") …
      .membership-wallet__metric-value.t-mono(v-else) {{ formattedBalance }}

    .membership-wallet__actions
      BaseButton(
        variant="primary"
        size="md"
        type="button"
        @click="openConvert"
      )
        q-icon(name="sync_alt" size="16px").q-mr-xs
        | Конвертировать в членский

  ConvertToBillingDialog
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { BaseButton, BaseCard } from 'src/shared/ui/base'
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
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

const displaySymbol = computed(
  () => symbol.value || system.info.symbols?.root_govern_symbol || 'RUB',
)

const formattedBalance = computed(() =>
  formatAsset2Digits(`${membership.value} ${displaySymbol.value}`),
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
.membership-wallet__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--p-3) 0;
}
.membership-wallet__metric-label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
.membership-wallet__metric-value {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  color: var(--p-ink);
  min-height: 32px;
}
.membership-wallet__actions {
  display: flex;
  gap: var(--p-2);
}
</style>
