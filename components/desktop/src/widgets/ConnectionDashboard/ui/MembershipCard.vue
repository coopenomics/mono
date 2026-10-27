<template lang="pug">
//- Главный блок подключения: остаток членских взносов и «Пополнить». Под
//- остатком — одна строка состояния оплаты: просрочка с суммой к пополнению,
//- приостановка, либо ближайшее списание. Отдельной карточки долга нет:
//- долг — состояние этого же кошелька (27.10.2026).
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
        .membership-card__state
          //- Долг: бейдж, сумма к пополнению, затем что именно просрочено.
          template(v-if="summary.hasDue || isSuspended")
            .membership-card__state-head
              BaseBadge(variant="neg") {{ badgeLabel }}
              span.membership-card__state-sum(v-if="shortfall > 0")
                | {{ $t('connectionDashboard.billingDueCard.topUpNeeded') }}
                |
                span.t-mono.t-num {{ formatPrice(shortfall) }}
            .membership-card__state-note(v-if="isReleased") {{ $t('connectionDashboard.billingDueCard.backupNote') }}
            .membership-card__state-note(v-for="sub in summary.overdue" :key="sub.id")
              | {{ $t('connectionDashboard.billingDueCard.overdueSince', { name: subscriptionName(sub), date: subscriptionDate(sub) }) }}
          //- Долга нет: ближайшее списание — чтобы остаток читался относительно него.
          template(v-else-if="nextCharge")
            .membership-card__state-head
              span.membership-card__state-label {{ $t('connectionDashboard.membershipCard.nextCharge') }}
              span.t-mono.t-num {{ formatPrice(nextCharge.price) }}
            .membership-card__state-note {{ $t('connectionDashboard.membershipCard.nextChargeLine', { date: subscriptionDate(nextCharge.sub), name: subscriptionName(nextCharge.sub) }) }}
        BaseButton(variant="primary" size="md" type="button" @click="openConvert")
          q-icon(name="add" size="16px").q-mr-xs
          | {{ $t('connectionDashboard.membershipWallet.topUp') }}

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
const isReleased = computed(() => instance.value?.is_released === true)
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

/** Название подписки; у приложения каталога — имя пакета с прописной. */
const subscriptionName = (sub: ProviderSubscription): string => {
  const code = String((sub as { subscription_type_code?: string }).subscription_type_code ?? '')
  if (!code.startsWith('catalog:')) return String((sub as { subscription_type_name?: string }).subscription_type_name ?? '')
  const tail = code.split('/').pop() ?? ''
  return tail.charAt(0).toUpperCase() + tail.slice(1)
}
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
/* Подвал кошелька: состояние слева тянется, кнопка прижата вправо. */
.membership-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4);
  width: 100%;
  flex-wrap: wrap;
}
.membership-card__state {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 240px;
}
.membership-card__state-head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  flex-wrap: wrap;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
}
.membership-card__state-sum {
  font-weight: 600;
}
.membership-card__state-label {
  color: var(--p-ink-2);
}
.membership-card__state-note {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}
</style>
