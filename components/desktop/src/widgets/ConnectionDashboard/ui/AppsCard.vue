<template lang="pug">
//- Приложения каталога (487-34): что кооператив может подключить и что уже
//- подключено. Подписка на приложение — строка общего счёта у провайдера:
//- оплачивается вместе с хостингом с того же членского кошелька.
//- Зоны строки: опознание (название, пакет, срок) → деньги (цена в месяц) →
//- состояние (бейдж) → действие (подключить / отключить).
.apps-card
  BaseCard(:title="$t('connectionDashboard.appsCard.title')" :subtitle="$t('connectionDashboard.appsCard.subtitle')")
    BaseBanner(v-if="error" variant="neg") {{ $t('connectionDashboard.appsCard.loadError', { error }) }}

    EmptyState(
      v-else-if="!firstLoad && !apps.length"
      :title="$t('connectionDashboard.appsCard.emptyTitle')"
      :body="$t('connectionDashboard.appsCard.emptyBody')"
    )
      template(#icon)
        q-icon(name="apps" size="28px")

    BaseTable(
      v-else
      :columns="columns"
      :rows="apps"
      row-key="package_id"
      :loading="firstLoad"
      :skeleton-rows="2"
      min-width="560px"
    )
      template(#cell-name="{ row }")
        .apps-card__name {{ row.title }}
        .apps-card__meta.t-mono {{ row.package_id }}
        .apps-card__meta(v-if="isLive(row)") {{ $t('connectionDashboard.appsCard.paidUntil', { date: formatDate(row.subscription.expires_at) }) }}

      template(#cell-price="{ row }")
        .apps-card__price.t-mono.t-num {{ formatPrice(priceOf(row)) }}
        .apps-card__meta {{ $t('connectionDashboard.appsCard.perMonth') }}

      template(#cell-status="{ row }")
        BaseBadge(v-if="isLive(row)" :variant="subscriptionStatusVariant(row.subscription.status)") {{ subscriptionStatusLabel(row.subscription.status) }}
        BaseBadge(v-else variant="neutral") {{ $t('connectionDashboard.appsCard.notConnected') }}

      template(#cell-action="{ row }")
        BaseButton(
          v-if="isLive(row)"
          variant="secondary"
          size="sm"
          type="button"
          :loading="busy === row.package_id"
          :disabled="!!busy"
          @click="disconnect(row)"
        ) {{ $t('connectionDashboard.appsCard.disconnect') }}
        BaseButton(
          v-else
          variant="primary"
          size="sm"
          type="button"
          :loading="busy === row.package_id"
          :disabled="!!busy"
          @click="connect(row)"
        ) {{ $t('connectionDashboard.appsCard.connect') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useProviderApps, useProviderSubscriptions, type ProviderApp } from 'src/features/Provider/model'
import { subscriptionStatusLabel, subscriptionStatusVariant } from 'src/entities/Union'
import { useSystemStore } from 'src/entities/System/model'
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'
import { t } from 'src/shared/i18n'

const { apps, isLoading, error, load, subscribe, cancel } = useProviderApps()
const { loadSubscriptions } = useProviderSubscriptions()
const { confirm } = useConfirm()
const { info } = useSystemStore()
const firstLoad = useFirstLoad(isLoading)
const busy = ref<string | null>(null)

// realtime: нет источника — подписки ведёт сервер провайдера (другой узел), в ленте кооператива их нет.
onMounted(load)

const columns: BaseTableColumn<ProviderApp>[] = [
  { key: 'name', label: t('connectionDashboard.appsCard.column.app') },
  { key: 'price', label: t('connectionDashboard.appsCard.column.price'), numeric: true, width: '150px' },
  { key: 'status', label: t('connectionDashboard.appsCard.column.status'), width: '150px', nowrap: true },
  { key: 'action', label: '', width: '140px' },
]

/** Подписка действует: отменённая — история, приложение снова можно подключить. */
const isLive = (app: ProviderApp): boolean =>
  !!app.subscription && String(app.subscription.status).toLowerCase() !== 'cancelled'

/** Цена месяца: у подключённого — зафиксированная при оформлении, иначе предложение. */
const priceOf = (app: ProviderApp): number =>
  isLive(app) ? Number(app.subscription?.amount_per_period ?? app.price) : Number(app.price)

const formatPrice = (price: number): string => {
  const sym = info.symbols?.root_govern_symbol || 'RUB'
  return formatAsset2Digits(`${String(price)} ${sym}`)
}

const formatDate = (iso: string): string => formatDateToLocalTimezone(iso, 'DD.MM.YYYY')

async function connect(app: ProviderApp): Promise<void> {
  const ok = await confirm({
    title: t('connectionDashboard.appsCard.connectConfirmTitle', { title: app.title }),
    message: t('connectionDashboard.appsCard.connectConfirmMessage', { price: formatPrice(app.price) }),
    confirmLabel: t('connectionDashboard.appsCard.connect'),
  })
  if (!ok) return
  await act(app, () => subscribe(app.package_id), t('connectionDashboard.appsCard.connected', { title: app.title }))
}

async function disconnect(app: ProviderApp): Promise<void> {
  const ok = await confirm({
    title: t('connectionDashboard.appsCard.disconnectConfirmTitle', { title: app.title }),
    message: t('connectionDashboard.appsCard.disconnectConfirmMessage'),
    confirmLabel: t('connectionDashboard.appsCard.disconnect'),
    danger: true,
  })
  if (!ok) return
  await act(app, () => cancel(app.package_id), t('connectionDashboard.appsCard.disconnected', { title: app.title }))
}

async function act(app: ProviderApp, run: () => Promise<unknown>, success: string): Promise<void> {
  busy.value = app.package_id
  try {
    await run()
    SuccessAlert(success)
    // Строка счёта добавлена или отменена — карточка подписок перечитывает её.
    await loadSubscriptions()
  } catch (e) {
    FailAlert(e)
  } finally {
    busy.value = null
  }
}
</script>

<style scoped>
.apps-card__name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  white-space: normal;
}
.apps-card__meta {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
  margin-top: 2px;
  white-space: normal;
}
.apps-card__price {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  white-space: nowrap;
}
</style>
