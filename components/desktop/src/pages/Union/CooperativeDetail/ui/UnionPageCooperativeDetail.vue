<template lang="pug">
.coop-detail.q-pa-md
  .coop-detail__back
    BaseButton(
      variant="ghost"
      size="sm"
      type="button"
      @click="goBack"
    )
      q-icon(name="arrow_back" size="16px").q-mr-xs
      | К реестру

  Loader(v-if="loading" :text="'Загрузка кооператива...'")

  BaseBanner(v-else-if="!row" variant="warn")
    | Кооператив не найден в реестре.

  template(v-else)
    BaseCard(
      :title="row.name || row.coopname"
      :subtitle="headerSubtitle"
    )
      template(#actions)
        .coop-detail__head-actions
          BaseChip(:variant="registryStatusVariant(row.status)" size="sm")
            span {{ registryStatusLabel(row.status) }}
          BaseButton(
            v-if="row.status !== 'active'"
            variant="ghost"
            size="sm"
            type="button"
            @click="activate"
          ) Активировать
          BaseButton(
            v-if="row.status !== 'blocked'"
            variant="ghost"
            size="sm"
            type="button"
            @click="block"
          ) Заблокировать

      DataRow(v-if="row.announce" label="Сайт" :value="row.announce" mono)
        template(#value-override)
          a.coop-detail__link.t-mono(
            :href="resolveSiteUrl(row.announce)"
            target="_blank"
            rel="noopener"
          ) {{ row.announce }}

    .coop-detail__section
      .coop-detail__section-title Подписки

      EmptyState(
        v-if="!row.subscriptions || !row.subscriptions.length"
        title="Подписок нет"
        body="У кооператива пока нет активных подписок у провайдера"
      )

      BaseCard(v-else variant="flat")
        BaseTable(
          :columns="subscriptionColumns"
          :rows="row.subscriptions"
          row-key="id"
        )
          template(#cell-name="{ row: sub }")
            .coop-detail__sub-name
              span {{ sub.subscription_type_name }}
          template(#cell-status="{ row: sub }")
            BaseChip(:variant="subscriptionStatusVariant(sub.status)" size="sm")
              span {{ subscriptionStatusLabel(sub.status) }}
          template(#cell-period="{ row: sub }")
            span.t-mono {{ sub.period_days }} дн.
          template(#cell-price="{ row: sub }")
            span.t-mono {{ formatMoney(sub.price) }} RUB
          template(#cell-next="{ row: sub }")
            span.t-mono(v-if="sub.next_payment_due") {{ formatDate(sub.next_payment_due) }}
            span.t-muted(v-else) —

    .coop-detail__section
      .coop-detail__section-title Кошельки кооператива в Восходе

      BaseBanner(v-if="walletError" variant="neg") {{ walletError }}

      .coop-detail__wallets
        BaseCard(variant="flat" title="Паевой взнос")
          .coop-detail__wallet-body
            .coop-detail__wallet-amount.t-mono(v-if="walletLoading") …
            .coop-detail__wallet-amount.t-mono(v-else)
              | {{ formatAmount(walletAvailable) }} {{ walletDisplaySymbol }}
            .coop-detail__wallet-hint Возвратный взнос на счёте пайщика в Восходе.

        BaseCard(variant="flat" title="Кошелёк членских взносов")
          .coop-detail__wallet-body
            .coop-detail__wallet-amount.t-mono(v-if="walletLoading") …
            .coop-detail__wallet-amount.t-mono(v-else)
              | {{ formatAmount(walletMembership) }} {{ walletDisplaySymbol }}
            .coop-detail__wallet-hint Списывается за инфраструктурные подписки.

    .coop-detail__section
      .coop-detail__section-title История оплат

      EmptyState(
        title="История пока недоступна"
        body="Раздел появится после реализации выгрузки операций биллинга по кооперативу."
      )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import moment from 'src/shared/lib/utils/dates/moment'
import {
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseChip,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives'
import { useActivateCooperative } from 'src/features/Union/ActivateCooperative'
import { useBlockCooperative } from 'src/features/Union/BlockCooperative'
import { useUnionStore } from 'src/entities/Union/model'
import type { ICooperativeRegistryItem } from 'src/entities/Union/model'
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

type BaseChipVariant = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn' | 'info'

const route = useRoute()
const router = useRouter()
const union = useUnionStore()
const system = useSystemStore()
const { loadCooperatives } = useLoadCooperatives()

const loading = ref(false)

const coopname = computed(() => String(route.params.detailCoopname || ''))

const row = computed<ICooperativeRegistryItem | undefined>(() =>
  union.coops.find((c) => c.coopname === coopname.value),
)

const {
  available: walletAvailable,
  membership: walletMembership,
  symbol: walletSymbolRaw,
  loading: walletLoading,
  error: walletError,
} = useCooperativeMainWallet(
  () => system.info.coopname || '',
  () => coopname.value,
)

const walletDisplaySymbol = computed(
  () => walletSymbolRaw.value || system.info.symbols?.root_govern_symbol || 'RUB',
)

const formatAmount = (amount: string): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount))

const load = async () => {
  loading.value = true
  try {
    await loadCooperatives()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

load()

const subscriptionColumns = [
  { key: 'name', label: 'Подписка', align: 'left' as const },
  { key: 'status', label: 'Статус', align: 'left' as const },
  { key: 'period', label: 'Период', align: 'right' as const, numeric: true },
  { key: 'price', label: 'Стоимость', align: 'right' as const, numeric: true },
  { key: 'next', label: 'След. оплата', align: 'right' as const },
]

const headerSubtitle = computed(() => {
  const r = row.value
  if (!r) return undefined
  const parts: string[] = [r.coopname]
  if (r.created_at) parts.push(`заявка от ${formatDateTime(r.created_at)}`)
  return parts.join(' · ')
})

const formatDate = (d: string) => moment(d).format('DD.MM.YYYY')
const formatDateTime = (d: string) => moment(d).format('DD.MM.YY HH:mm')
const formatMoney = (value: number | string): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))

const resolveSiteUrl = (announce: string): string =>
  /^https?:\/\//.test(announce) ? announce : `https://${announce}`

const registryStatusVariant = (status: string): BaseChipVariant => {
  switch (status) {
    case 'active':
      return 'pos'
    case 'pending':
      return 'warn'
    case 'blocked':
      return 'neg'
    default:
      return 'neutral'
  }
}

const registryStatusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'активен'
    case 'pending':
      return 'на рассмотрении'
    case 'blocked':
      return 'заблокирован'
    default:
      return status
  }
}

const subscriptionStatusVariant = (status: string): BaseChipVariant => {
  switch (status) {
    case 'ACTIVE':
      return 'pos'
    case 'TRIAL':
      return 'info'
    case 'EXPIRED':
      return 'warn'
    case 'CANCELLED':
      return 'neg'
    default:
      return 'neutral'
  }
}

const subscriptionStatusLabel = (status: string): string => {
  switch (status) {
    case 'ACTIVE':
      return 'активна'
    case 'TRIAL':
      return 'триал'
    case 'EXPIRED':
      return 'истекла'
    case 'CANCELLED':
      return 'отменена'
    default:
      return status
  }
}

const goBack = () => {
  const params = { ...route.params }
  delete (params as any).detailCoopname
  router.push({ name: 'union-cooperatives', params })
}

const activate = async () => {
  if (!row.value) return
  const { activateCooperative } = useActivateCooperative()
  try {
    await activateCooperative(row.value.coopname)
    await load()
    SuccessAlert('Кооператив активирован')
  } catch (e: any) {
    FailAlert(e)
  }
}

const block = async () => {
  if (!row.value) return
  const { blockCooperative } = useBlockCooperative()
  try {
    await blockCooperative(row.value.coopname)
    await load()
    SuccessAlert('Кооператив заблокирован')
  } catch (e: any) {
    FailAlert(e)
  }
}
</script>

<style scoped>
.coop-detail__back {
  margin-bottom: var(--p-3);
}
.coop-detail__head-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
}
.coop-detail__link {
  color: var(--p-primary);
  text-decoration: none;
}
.coop-detail__link:hover {
  text-decoration: underline;
}
.coop-detail__section {
  margin-top: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.coop-detail__section-title {
  font-size: var(--p-fs-h6);
  font-weight: 600;
  color: var(--p-ink);
}
.coop-detail__sub-name {
  display: inline-flex;
  align-items: center;
}
.coop-detail__wallets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--p-3);
}
.coop-detail__wallet-body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding: var(--p-2) 0;
}
.coop-detail__wallet-amount {
  font-size: var(--p-fs-h6);
  font-weight: 700;
  color: var(--p-ink);
}
.coop-detail__wallet-hint {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}
</style>
