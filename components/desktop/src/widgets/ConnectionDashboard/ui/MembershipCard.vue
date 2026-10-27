<template lang="pug">
//- Кошелёк членских взносов: остаток, «Пополнить» и одна строка состояния
//- оплаты — просрочка с суммой к пополнению, приостановка либо ближайшее
//- списание. Подробности о подписках — на вкладке «Подписки» (27.10.2026).
.membership-card
  WalletCard(
    program="wallet"
    :title="$t('connectionDashboard.membershipWallet.title')"
    :subtitle="$t('connectionDashboard.membershipWallet.subtitle')"
    :balance="balance.amount"
    :symbol="balance.symbol || fallbackSymbol"
    :loading="initialLoading"
  )
    template(#actions)
      .membership-card__foot
        BaseButton(variant="primary" size="md" type="button" @click="openConvert")
          q-icon(name="add" size="16px").q-mr-xs
          | {{ $t('connectionDashboard.membershipWallet.topUp') }}
        .membership-card__state(v-if="summary.hasDue || isSuspended")
          BaseBadge(variant="neg") {{ badgeLabel }}
          span(v-if="shortfall > 0") {{ $t('connectionDashboard.membershipCard.topUpBy', { amount: formatPrice(shortfall) }) }}
        .membership-card__state(v-else-if="nextCharge")
          span {{ $t('connectionDashboard.membershipCard.nextChargeLine', { amount: formatPrice(nextCharge.price), date: subscriptionDate(nextCharge.sub) }) }}

  ConvertToBillingDialog
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Ledger2Contract } from 'cooptypes'
import { BaseBadge, BaseButton } from 'src/shared/ui/base'
import { WalletCard } from 'src/shared/ui/domain'
import { useBillingWallet } from 'src/entities/Wallet/model'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import {
  isFreeSubscription,
  subscriptionPeriodPrice,
  summarizeSubscriptions,
  useProviderSubscriptions,
  type ProviderSubscription,
} from 'src/features/Provider/model'
import { ConvertToBillingDialog, useConvertToBillingVisibility } from 'src/features/Billing/ConvertToBilling'
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { t } from 'src/shared/i18n'

const session = useSessionStore()
const system = useSystemStore()
const connection = useConnectionAgreementStore()
const { subscriptions, loadSubscriptions } = useProviderSubscriptions()

// Подписки нужны строке состояния: просрочка и ближайшее списание.
// realtime: нет источника — подписки ведёт сервер провайдера (другой узел), в ленте кооператива их нет.
onMounted(() => {
  void loadSubscriptions()
})

// Биллинг-кошелёк (`w.wal.bill`): на него ложится пополнение, с него провайдер
// списывает подписки. Остаток живёт по ленте цепи.
const { available, symbol, initialLoading, refresh } = useBillingWallet(
  () => system.info.coopname || '',
  () => session.username || '',
)
const live = useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], refresh)

const fallbackSymbol = computed(() => system.info.symbols?.root_govern_symbol || 'RUB')
const balance = computed(() => splitAsset2Digits(`${available.value} ${symbol.value || fallbackSymbol.value}`))
const walletAvailable = computed(() => Number(available.value) || 0)

const summary = computed(() => summarizeSubscriptions(subscriptions.value))
const shortfall = computed(() => Math.max(0, summary.value.dueTotal - walletAvailable.value))

const instance = computed(() => connection.currentInstance)
const isSuspended = computed(() => instance.value?.maintenance_mode === true)
const badgeLabel = computed(() =>
  isSuspended.value ? t('connectionDashboard.billingDueCard.suspended') : t('connectionDashboard.billingDueCard.overdue'),
)

/** Ближайшее списание: платная подписка с самым ранним концом оплаченного срока. */
const nextCharge = computed<{ sub: ProviderSubscription; price: number } | null>(() => {
  const upcoming = subscriptions.value
    .filter((s) => !isFreeSubscription(s) && !String((s as { status?: string }).status ?? '').toLowerCase().startsWith('cancel'))
    .map((s) => ({ sub: s, at: new Date(String((s as { expires_at?: string }).expires_at ?? '')).getTime() }))
    .filter((x) => Number.isFinite(x.at))
    .sort((a, b) => a.at - b.at)[0]
  return upcoming ? { sub: upcoming.sub, price: subscriptionPeriodPrice(upcoming.sub) } : null
})

const subscriptionDate = (sub: ProviderSubscription): string => {
  const expires = (sub as { expires_at?: string }).expires_at
  return expires ? formatDateToLocalTimezone(expires, 'DD.MM.YYYY') : '—'
}

const formatPrice = (price: number | string): string =>
  formatAsset2Digits(`${String(price)} ${fallbackSymbol.value}`)

const { isVisible } = useConvertToBillingVisibility()
const openConvert = () => {
  isVisible.value = true
}
// После закрытия диалога пополнения остаток перечитывается один раз.
watch(isVisible, (open, wasOpen) => {
  if (wasOpen && !open) void live.refresh()
})
</script>

<style scoped>
.membership-card {
  display: contents;
}
/* Подвал кошелька: кнопка слева, состояние оплаты одной строкой рядом. */
.membership-card__foot {
  display: flex;
  align-items: center;
  gap: var(--p-4);
  width: 100%;
  flex-wrap: wrap;
}
.membership-card__state {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  min-width: 0;
}
</style>
