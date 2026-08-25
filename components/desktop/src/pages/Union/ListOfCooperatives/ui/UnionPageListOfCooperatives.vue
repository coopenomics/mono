<template lang="pug">
.coop-registry.q-pa-md
  .banner
    q-icon.banner__icon(name="info" size="18px")
    .banner__body
      | Заявки кооперативов на подключение к платформе. Совет читает рассказ о деятельности и устав,
      | подтверждает подключение — после этого провайдер начинает поставку.

  Loader(v-if="onLoading" :text="'Загрузка реестра...'")

  EmptyState(
    v-else-if="!coops || !coops.length"
    title="Заявок нет"
    body="Кооперативы, подавшие заявку на подключение, появятся здесь"
  )
    template(#icon)
      q-icon(name="handshake" size="28px")

  .coop-registry__list(v-else)
    BaseCard.coop-registry__card(
      v-for="row in coops"
      :key="row.coopname"
      @click="openDetail(row.coopname)"
    )
      .coop-registry__head
        .coop-registry__title
          .coop-registry__name {{ row.name || row.coopname }}
          .t-meta.t-muted {{ cardSubtitle(row) }}
          //- Домен — часть удостоверения кооператива: совет узнаёт заявку
          //- по адресу не хуже, чем по названию, и открывает сайт отсюда же.
          a.coop-registry__domain(
            v-if="row.announce"
            :href="resolveSiteUrl(row.announce)"
            target="_blank"
            rel="noopener"
            @click.stop
          )
            q-icon(name="language" size="14px")
            span.t-mono {{ row.announce }}
        BaseChip(:variant="registryStatusVariant(row.status)" size="sm")
          span {{ registryStatusLabel(row.status) }}

      //- Первое, что нужно совету на строке заявки: чем кооператив занимается
      //- и приложен ли устав. Полный текст и сам файл — в карточке кооператива.
      p.coop-registry__about(v-if="row.description") {{ row.description }}
      p.coop-registry__about.t-muted(v-else) Рассказ о деятельности не заполнен.

      .coop-registry__summary
        .coop-registry__metric
          .coop-registry__metric-label Устав
          .coop-registry__metric-value
            BaseChip(:variant="row.charter ? 'pos' : 'warn'" size="sm")
              q-icon(v-if="row.charter" name="check" size="12px").q-mr-xs
              span {{ row.charter ? 'приложен' : 'не приложен' }}
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
            span.t-muted(v-else) не разворачивался

      .coop-registry__actions
        BaseButton(
          variant="ghost"
          size="sm"
          type="button"
          @click.stop="openDetail(row.coopname)"
        ) Открыть заявку
        q-space
        CooperativeDecisionActions(
          :coopname="row.coopname"
          :name="row.name"
          :status="row.status"
          @decided="load"
        )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import moment from 'src/shared/lib/utils/dates/moment'
import { BaseButton, BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base'
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives'
import { CooperativeDecisionActions } from 'src/widgets/CooperativeDecision'
import { useUnionStore } from 'src/entities/Union/model'
import type { ICooperativeRegistryItem } from 'src/entities/Union/model'
import {
  instanceStatusLabel,
  instanceStatusVariant,
  registryStatusLabel,
  registryStatusVariant,
} from 'src/entities/Union'
import { FailAlert } from 'src/shared/api/alerts'

type ICooperativeSubscription = ICooperativeRegistryItem['subscriptions'][number]

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

const formatDateTime = (value: string): string => moment(value).format('DD.MM.YY HH:mm')

const formatMoney = (value: number | string): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))

const cardSubtitle = (row: ICooperativeRegistryItem): string => {
  const parts: string[] = [row.coopname]
  if (row.created_at) parts.push(`заявка от ${formatDateTime(row.created_at)}`)
  return parts.join(' · ')
}

const resolveSiteUrl = (announce: string): string =>
  /^https?:\/\//.test(announce) ? announce : `https://${announce}`

const openDetail = (coopname: string) => {
  const params = { ...route.params, detailCoopname: coopname }
  router.push({ name: 'union-cooperative-detail', params })
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
  transition: border-color var(--p-dur-fast) var(--p-ease-standard);
}
.coop-registry__card:hover {
  border-color: var(--p-primary);
}
.coop-registry__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}
.coop-registry__title {
  flex: 1;
  min-width: 0;
}
.coop-registry__name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.coop-registry__domain {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  margin-top: var(--p-2);
  color: var(--p-primary);
  text-decoration: none;
  font-size: var(--p-fs-body-sm);
}
.coop-registry__domain:hover {
  text-decoration: underline;
}
.coop-registry__about {
  margin: var(--p-3) 0 0;
  color: var(--p-ink-1);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.coop-registry__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--p-4);
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.coop-registry__metric-label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
.coop-registry__metric-value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.coop-registry__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>
