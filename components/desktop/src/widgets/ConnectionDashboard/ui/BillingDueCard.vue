<template lang="pug">
//- Просрочка — состояние всей платформы, а не строка реестра: пока долг не
//- закрыт, кооператив рискует остаться без сервера. Поэтому карточка стоит
//- первой и говорит ровно три вещи: сколько должны, сколько есть, сколько
//- пополнить. Перечень услуг и итог месяца — ниже, в реестре подписок.
BaseCard(v-if="visible")
  .due-card
    .due-card__head
      BaseBadge(variant="neg") {{ badgeLabel }}
      span.due-card__head-note(v-if="isReleased") {{ $t('connectionDashboard.billingDueCard.backupNote') }}

    //- Что именно просрочено и с какой даты: без этого «к оплате 3 500»
    //- выглядело произвольным числом (26.10.2026).
    p.due-card__intro(v-if="summary.overdue.length") {{ $t('connectionDashboard.billingDueCard.overdueIntro') }}
    ul.due-card__list(v-if="summary.overdue.length")
      li(v-for="sub in summary.overdue" :key="sub.id")
        | {{ $t('connectionDashboard.billingDueCard.overdueSince', { name: overdueName(sub), date: overdueDate(sub) }) }}

    .due-card__rows
      .due-card__row
        span {{ $t('connectionDashboard.billingDueCard.dueLabel') }}
        span.t-mono.t-num {{ formatPrice(summary.dueTotal) }}
      .due-card__row
        span {{ $t('connectionDashboard.billingDueCard.walletLabel') }}
        span.t-mono.t-num {{ formatPrice(walletAvailable) }}
      .due-card__row.due-card__row--accent(v-if="shortfall > 0")
        span {{ $t('connectionDashboard.billingDueCard.topUpNeeded') }}
        span.t-mono.t-num {{ formatPrice(shortfall) }}

  template(#footer)
    BaseButton(
      variant="primary"
      size="md"
      type="button"
      @click="openConvert"
    )
      q-icon(name="add" size="16px").q-mr-xs
      | {{ $t('connectionDashboard.billingDueCard.topUp') }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base'
import { summarizeSubscriptions, useProviderSubscriptions } from 'src/features/Provider/model'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useBillingWallet } from 'src/entities/Wallet/model'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { useConvertToBillingVisibility } from 'src/features/Billing/ConvertToBilling'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { t } from 'src/shared/i18n';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone'

const session = useSessionStore()
const system = useSystemStore()
const connection = useConnectionAgreementStore()

// Подписки — общий стейт витрины подключения: их грузит реестр подписок,
// карточка просрочки читает те же данные и не ходит за ними второй раз.
const { subscriptions } = useProviderSubscriptions()

const summary = computed(() => summarizeSubscriptions(subscriptions.value))

const instance = computed(() => connection.currentInstance)
/** Сервер отдан хостеру: платформа поднимется заново из резервной копии. */
const isReleased = computed(() => instance.value?.is_released === true)
/** На домене стоит заглушка «временно недоступен». */
const isSuspended = computed(() => instance.value?.maintenance_mode === true)

const visible = computed(() => summary.value.hasDue || isSuspended.value || isReleased.value)

const badgeLabel = computed(() =>
  isSuspended.value || isReleased.value ? t('connectionDashboard.billingDueCard.suspended') : t('connectionDashboard.billingDueCard.overdue'),
)

const { available, symbol } = useBillingWallet(
  () => system.info.coopname || '',
  () => session.username || '',
)

const fallbackSymbol = computed(() => system.info.symbols?.root_govern_symbol || 'RUB')

const walletAvailable = computed(() => Number(available.value) || 0)

const shortfall = computed(() => Math.max(0, summary.value.dueTotal - walletAvailable.value))

// Та же запись суммы, что в реестре подписок: символ печатает форматтер.
const formatPrice = (price: number | string): string =>
  formatAsset2Digits(`${String(price)} ${symbol.value || fallbackSymbol.value}`)

const { isVisible } = useConvertToBillingVisibility()
const openConvert = () => {
  isVisible.value = true
}

/** Название просроченной подписки; у приложения каталога — имя пакета. */
const overdueName = (sub: any): string => {
  const code = String(sub?.subscription_type_code ?? '')
  if (!code.startsWith('catalog:')) return String(sub?.subscription_type_name ?? '')
  const tail = code.split('/').pop() ?? ''
  return tail.charAt(0).toUpperCase() + tail.slice(1)
}

/** Дата, с которой подписка не оплачена: конец оплаченного срока. */
const overdueDate = (sub: any): string =>
  sub?.expires_at ? formatDateToLocalTimezone(sub.expires_at, 'DD.MM.YYYY') : '—'
</script>

<style scoped>
.due-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.due-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
}
.due-card__head-note {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
.due-card__intro {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.due-card__list {
  margin: 0;
  padding-left: var(--p-5);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink);
}
.due-card__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.due-card__row {
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
/* Сколько именно донести — главное число карточки. */
.due-card__row--accent {
  color: var(--p-ink);
  font-weight: 600;
  padding-top: var(--p-2);
  border-top: 1px solid var(--p-line);
}
</style>
