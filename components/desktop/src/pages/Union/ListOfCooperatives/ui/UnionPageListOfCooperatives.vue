<template lang="pug">
.coop-registry.q-pa-md
  .banner
    q-icon.banner__icon(name="info" size="18px")
    .banner__body
      | Заявки на подключение к платформе и состояние подписок у провайдера.

  Loader(v-if="onLoading" :text="'Загрузка реестра...'")

  EmptyState(
    v-else-if="!coops || !coops.length"
    title="Нет кооперативов"
    body="В реестре пока нет заявок на подключение"
  )

  .coop-registry__list(v-else)
    BaseCard.coop-registry__card(
      v-for="row in coops"
      :key="row.coopname"
      :title="row.name || row.coopname"
      :subtitle="cardSubtitle(row)"
      @click="openDetail(row.coopname)"
    )
      template(#actions)
        .coop-registry__head-actions
          BaseChip(:variant="registryStatusVariant(row.status)" size="sm")
            span {{ registryStatusLabel(row.status) }}
          BaseButton(
            v-if="row.status !== 'active'"
            variant="ghost"
            size="sm"
            type="button"
            @click.stop="activate(row.coopname)"
          ) Активировать
          BaseButton(
            v-if="row.status !== 'blocked'"
            variant="ghost"
            size="sm"
            type="button"
            @click.stop="block(row.coopname)"
          ) Заблокировать

      .coop-registry__summary
        .coop-registry__metric
          .coop-registry__metric-label Подписок
          .coop-registry__metric-value.t-mono {{ row.subscriptions?.length || 0 }}
        .coop-registry__metric
          .coop-registry__metric-label Сумма в месяц
          .coop-registry__metric-value.t-mono
            | {{ formatMoney(monthlyTotal(row)) }} RUB
        .coop-registry__metric
          .coop-registry__metric-label Следующая оплата
          .coop-registry__metric-value.t-mono {{ nextPaymentLabel(row) }}
        .coop-registry__metric
          .coop-registry__metric-label Хостинг
          .coop-registry__metric-value
            BaseChip(v-if="hostingStatus(row)" :variant="instanceStatusVariant(hostingStatus(row))" size="sm")
              span {{ instanceStatusLabel(hostingStatus(row)) }}
            span.t-muted(v-else) нет
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import moment from 'src/shared/lib/utils/dates/moment'
import {
  BaseButton,
  BaseCard,
  BaseChip,
  EmptyState,
} from 'src/shared/ui/base'
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives'
import { useActivateCooperative } from 'src/features/Union/ActivateCooperative'
import { useBlockCooperative } from 'src/features/Union/BlockCooperative'
import { useUnionStore } from 'src/entities/Union/model'
import type { ICooperativeRegistryItem } from 'src/entities/Union/model'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

type ICooperativeSubscription = ICooperativeRegistryItem['subscriptions'][number]
type BaseChipVariant = 'neutral' | 'accent' | 'pos' | 'neg' | 'warn' | 'info'

const router = useRouter()
const route = useRoute()
const union = useUnionStore()
const { loadCooperatives } = useLoadCooperatives()

const coops = computed(() => union.coops)

const onLoading = ref(false)

const load = async () => {
  onLoading.value = true
  try {
    await loadCooperatives()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    onLoading.value = false
  }
}

load()

const hostingSubscription = (row: ICooperativeRegistryItem): ICooperativeSubscription | undefined =>
  row.subscriptions?.find((s) => !!s.instance_status)

const hostingStatus = (row: ICooperativeRegistryItem): string | null =>
  hostingSubscription(row)?.instance_status ?? null

const monthlyTotal = (row: ICooperativeRegistryItem): number =>
  (row.subscriptions ?? []).reduce((sum, s) => sum + (Number(s.price) || 0), 0)

const nextPaymentDate = (row: ICooperativeRegistryItem): string | null => {
  const dates = (row.subscriptions ?? [])
    .map((s) => s.next_payment_due)
    .filter(Boolean) as string[]
  if (!dates.length) return null
  return dates.sort()[0]
}

const nextPaymentLabel = (row: ICooperativeRegistryItem): string => {
  const d = nextPaymentDate(row)
  return d ? moment(d).format('DD.MM.YYYY') : '—'
}

const formatDateTime = (value: string): string =>
  moment(value).format('DD.MM.YY HH:mm')

const formatMoney = (value: number | string): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))

const cardSubtitle = (row: ICooperativeRegistryItem): string | undefined => {
  const parts: string[] = []
  if (row.name) parts.push(row.coopname)
  if (row.created_at) parts.push(`заявка от ${formatDateTime(row.created_at)}`)
  return parts.length ? parts.join(' · ') : undefined
}

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

const instanceStatusVariant = (status: string | null): BaseChipVariant => {
  switch (status) {
    case 'active':
      return 'pos'
    case 'install':
    case 'rent':
    case 'pending':
      return 'warn'
    case 'error':
    case 'blocked':
    case 'requires_manual_review':
      return 'neg'
    default:
      return 'neutral'
  }
}

const instanceStatusLabel = (status: string | null): string => {
  switch (status) {
    case 'active':
      return 'активен'
    case 'install':
      return 'установка'
    case 'rent':
      return 'аренда'
    case 'pending':
      return 'ожидание'
    case 'error':
      return 'ошибка'
    case 'blocked':
      return 'заблокирован'
    case 'requires_manual_review':
      return 'нужна проверка'
    default:
      return status ?? '—'
  }
}

const openDetail = (coopname: string) => {
  const params = { ...route.params, detailCoopname: coopname }
  router.push({ name: 'union-cooperative-detail', params })
}

const activate = async (coopname: string) => {
  const { activateCooperative } = useActivateCooperative()
  try {
    await activateCooperative(coopname)
    await load()
    SuccessAlert('Кооператив активирован')
  } catch (e: any) {
    FailAlert(e)
  }
}

const block = async (coopname: string) => {
  const { blockCooperative } = useBlockCooperative()
  try {
    await blockCooperative(coopname)
    await load()
    SuccessAlert('Кооператив заблокирован')
  } catch (e: any) {
    FailAlert(e)
  }
}
</script>

<style scoped>
.coop-registry__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  margin-top: var(--p-4);
}
.coop-registry__card {
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.coop-registry__card:hover {
  border-color: var(--p-primary);
}
.coop-registry__head-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
}
.coop-registry__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--p-3);
  padding: var(--p-3) 0;
}
.coop-registry__metric {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.coop-registry__metric-label {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}
.coop-registry__metric-value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
