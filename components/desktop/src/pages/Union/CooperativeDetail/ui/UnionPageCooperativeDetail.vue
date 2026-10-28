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
      | {{ $t('union.cooperativeDetail.backToRegistry') }}

  Loader(v-if="loading" :text="$t('union.cooperativeDetail.loading')")

  BaseBanner(v-else-if="!row" variant="warn")
    | {{ $t('union.cooperativeDetail.notFound') }}

  template(v-else)
    //- Шапка: кто подал, в каком состоянии и что с этим делать. Всё
    //- остальное разнесено по вкладкам — на одном экране совет тонул
    //- в подписках и кошельках, не дойдя до решения.
    BaseCard
      .coop-detail__head
        .coop-detail__title
          .coop-detail__name {{ row.name || row.coopname }}
          .t-meta.t-muted {{ headerSubtitle }}
          //- Домен — часть удостоверения кооператива, а не отдельная строка
          //- «поле → значение»: в широкой карточке она разрывалась пустотой.
          a.coop-detail__domain(
            v-if="row.announce"
            :href="resolveSiteUrl(row.announce)"
            target="_blank"
            rel="noopener"
          )
            q-icon(name="language" size="14px")
            span.t-mono {{ row.announce }}
          //- Тариф заявки — в шапке: совет решает о подключении, зная, на
          //- каких условиях кооператив подключается.
          .coop-detail__tariff(v-if="row.tariff")
            q-icon(name="sell" size="14px")
            span {{ $t('union.tariff.headline', { name: row.tariff.name, price: tariffPriceLabel(row), ...tariffVolumeBreakdown(row.tariff.docflow_axon ?? 0) }) }}
        BaseChip(:variant="registryStatusVariant(row.status)" size="sm")
          span {{ registryStatusLabel(row.status) }}

      .coop-detail__decision
        CooperativeDecisionActions(
          :coopname="row.coopname"
          :name="row.name"
          :status="row.status"
          @decided="load"
        )

    PageTabs.coop-detail__tabs(
      :tabs="tabs"
      :active-key="activeTab"
      @select="(tab) => (activeTab = tab.key)"
    )
      template(#actions)
        BaseButton(
          v-if="activeTab === 'prices'"
          variant="primary"
          size="sm"
          type="button"
          @click="pricesCard?.openCreate()"
        )
          q-icon(name="add" size="16px").q-mr-xs
          | {{ $t('union.coopPrices.assign') }}

    //- ─────────────── Описание ───────────────
    .coop-detail__section(v-if="activeTab === 'about'")
      BaseCard(variant="flat")
        p.coop-detail__about(v-if="row.description") {{ row.description }}
        p.coop-detail__about.t-muted(v-else) {{ $t('union.cooperativeDetail.noDescription') }}

        //- Устав — то, по чему совет решает, подтверждать ли подключение.
        DocumentRow(v-if="charterDocument" :document="charterDocument")
          template(#actions)
            BaseButton(
              variant="secondary"
              size="sm"
              type="button"
              :loading="charterOpening"
              @click="openCharter"
            )
              q-icon(name="open_in_new" size="14px").q-mr-xs
              | {{ $t('union.cooperativeDetail.openCharter') }}
        .coop-detail__charter-missing(v-else)
          q-icon(name="warning" size="20px")
          span.t-sm.t-muted {{ $t('union.cooperativeDetail.noCharter') }}

    //- ─────────────── Подписки ───────────────
    .coop-detail__section(v-else-if="activeTab === 'subscriptions'")
      //- Состав тарифа: каждая строка с ценой и состоянием. До решения совета
      //- заведён только документооборот, остальное — «при поставке».
      BaseTable(
        v-if="row.tariff"
        :columns="tariffColumns"
        :rows="tariffLines(row)"
        row-key="code"
      )
        template(#cell-name="{ row: line }")
          .coop-detail__sub-name {{ line.label }}
          .t-meta.t-muted(v-if="line.detail") {{ line.detail }}
        template(#cell-price="{ row: line }")
          //- Индивидуальная цена кооператива главнее строки тарифа: показываем
          //- её, прейскурант остаётся рядом зачёркнутым.
          template(v-if="individualPriceOf(line.code) != null")
            span.t-mono {{ individualPriceOf(line.code) === 0 ? $t('union.coopPrices.free') : formatRub(individualPriceOf(line.code) ?? 0) }}
            span.t-meta.t-muted.coop-detail__list-price {{ formatRub(line.monthlyPrice) }}
          span.t-mono(v-else) {{ formatRub(line.monthlyPrice) }}
        template(#cell-status="{ row: line }")
          BaseChip(v-if="line.subscription" :variant="subscriptionStatusVariant(line.subscription.status)" size="sm")
            span {{ subscriptionStatusLabel(line.subscription.status) }}
          BaseChip(v-else variant="neutral" size="sm")
            span {{ $t('union.tariff.onDelivery') }}
        template(#cell-next="{ row: line }")
          span.t-mono(v-if="line.subscription?.next_payment_due") {{ formatDate(line.subscription.next_payment_due) }}
          span.t-muted(v-else) —
      p.t-meta.t-muted.coop-detail__tariff-note(v-if="row.tariff") {{ $t('union.tariff.note', { price: tariffPriceLabel(row) }) }}

      BaseCard(v-if="!row.tariff || extraSubscriptions(row).length" variant="flat" :title="row.tariff ? $t('union.tariff.otherSubscriptions') : undefined")
        EmptyState(
          v-if="!subscriptionsCount"
          :title="$t('union.cooperativeDetail.noSubscriptionsTitle')"
          :body="$t('union.cooperativeDetail.noSubscriptionsBody')"
        )
          template(#icon)
            q-icon(name="receipt_long" size="48px")
        BaseTable(
          v-else
          :columns="subscriptionColumns"
          :rows="row.tariff ? extraSubscriptions(row) : row.subscriptions"
          row-key="id"
        )
          template(#cell-name="{ row: sub }")
            .coop-detail__sub-name
              span {{ sub.subscription_type_name }}
          template(#cell-status="{ row: sub }")
            BaseChip(:variant="subscriptionStatusVariant(sub.status)" size="sm")
              span {{ subscriptionStatusLabel(sub.status) }}
          template(#cell-period="{ row: sub }")
            span.t-mono {{ $t('union.cooperativeDetail.periodDays', { days: sub.period_days }) }}
          template(#cell-price="{ row: sub }")
            span.t-mono {{ formatMoney(sub.price) }} RUB
          template(#cell-next="{ row: sub }")
            span.t-mono(v-if="sub.next_payment_due") {{ formatDate(sub.next_payment_due) }}
            span.t-muted(v-else) —

    //- ─────────────── Кошельки ───────────────
    .coop-detail__section(v-else-if="activeTab === 'wallets'")
      BaseBanner(v-if="walletError" variant="neg") {{ walletError }}

      .coop-detail__wallets
        BaseCard(variant="flat" :title="$t('union.cooperativeDetail.shareWalletTitle')")
          .coop-detail__wallet-body
            .coop-detail__wallet-amount.t-mono(v-if="walletLoading") …
            .coop-detail__wallet-amount.t-mono(v-else)
              | {{ formatAmount(walletAvailable) }} {{ walletDisplaySymbol }}
            .coop-detail__wallet-hint {{ $t('union.cooperativeDetail.shareWalletHint') }}

        BaseCard(variant="flat" :title="$t('union.cooperativeDetail.billingWalletTitle')")
          .coop-detail__wallet-body
            .coop-detail__wallet-amount.t-mono(v-if="walletLoading") …
            .coop-detail__wallet-amount.t-mono(v-else)
              | {{ formatAmount(walletMembership) }} {{ walletDisplaySymbol }}
            .coop-detail__wallet-hint {{ $t('union.cooperativeDetail.billingWalletHint') }}

    //- ─────────────── Индивидуальные цены ───────────────
    //- Оператор назначает кооперативу свою цену услуги до подписки: витрина
    //- и новые подписки кооператива берут её сразу (28.10.2026).
    .coop-detail__section(v-else-if="activeTab === 'prices'")
      CoopPricesCard(ref="pricesCard" :coopname="coopname" @changed="load")

    //- ─────────────── История оплат ───────────────
    //- Та же таблица журнала списаний, что и у кооператива на дашборде
    //- подключения, — общий виджет, а не копия разметки.
    .coop-detail__section(v-else)
      PaymentsHistory(:coopname="coopname")

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
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { DocumentRow } from 'src/shared/ui/domain'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { CooperativeDecisionActions } from 'src/widgets/CooperativeDecision'
import { PaymentsHistory } from 'src/widgets/Billing/PaymentsHistory'
import { CoopPricesCard } from 'src/widgets/Union/CoopPricesCard'
import { useCoopPrices } from 'src/features/Union/CoopPrices'
import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives'
import { cooperativeCharterApi } from 'src/features/Union/UploadCooperativeCharter'
import { useUnionStore } from 'src/entities/Union/model'
import {
  registryStatusLabel,
  registryStatusVariant,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
} from 'src/entities/Union'
import type { ICooperativeRegistryItem } from 'src/entities/Union/model'
import { extraSubscriptions, formatRub, tariffLines, tariffPriceLabel } from 'src/entities/Union'
import { tariffVolumeBreakdown } from 'src/shared/lib/axon'
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert } from 'src/shared/api/alerts'
import { t } from 'src/shared/i18n';

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
    await pricesCard.value?.reload?.()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

// realtime: нет источника — карточку собирает сервер из цепи и данных провайдера (другой узел), а узел хранит и сигналит только строку своего кооператива; журнал оплат на карточке живёт по ленте сам.
load()

const subscriptionColumns = [
  { key: 'name', label: t('union.cooperativeDetail.column.subscription'), align: 'left' as const },
  { key: 'status', label: t('union.cooperativeDetail.column.status'), align: 'left' as const },
  { key: 'period', label: t('union.cooperativeDetail.column.period'), align: 'right' as const, numeric: true },
  { key: 'price', label: t('union.cooperativeDetail.column.price'), align: 'right' as const, numeric: true },
  { key: 'next', label: t('union.cooperativeDetail.column.nextPayment'), align: 'right' as const },
]

const tariffColumns = [
  { key: 'name', label: t('union.tariff.column.line'), align: 'left' as const },
  { key: 'price', label: t('union.tariff.column.monthlyPrice'), align: 'right' as const, numeric: true },
  { key: 'status', label: t('union.cooperativeDetail.column.status'), align: 'left' as const },
  { key: 'next', label: t('union.cooperativeDetail.column.nextPayment'), align: 'right' as const },
]

const headerSubtitle = computed(() => {
  const r = row.value
  if (!r) return undefined
  const parts: string[] = [r.coopname]
  if (r.created_at) parts.push(t('union.cooperativeDetail.applicationFrom', { date: formatDateTime(r.created_at) }))
  return parts.join(' · ')
})

const charterOpening = ref(false)

/**
 * Ссылка на устав короткоживущая (её TTL задан бакетом), поэтому в списке она
 * не передаётся — запрашиваем свежую в момент клика и открываем новой вкладкой.
 */
const openCharter = async () => {
  if (!row.value) return
  charterOpening.value = true
  try {
    const fresh = await cooperativeCharterApi.loadCooperativeCharter(
      system.info.coopname,
      row.value.coopname,
    )
    if (fresh?.read_url) window.open(fresh.read_url, '_blank', 'noopener')
    else FailAlert(t('union.cooperativeDetail.charterLinkUnavailable'))
  } catch (e: any) {
    FailAlert(e)
  } finally {
    charterOpening.value = false
  }
}

const formatFileSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? t('union.cooperativeDetail.sizeMb', { size: mb.toFixed(1) }) : t('union.cooperativeDetail.sizeKb', { size: Math.max(1, Math.round(bytes / 1024)) })
}

const formatDate = (d: string) => moment(d).format('DD.MM.YYYY')
const formatDateTime = (d: string) => moment(d).format('DD.MM.YY HH:mm')
const formatMoney = (value: number | string): string =>
  new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value))

const resolveSiteUrl = (announce: string): string =>
  /^https?:\/\//.test(announce) ? announce : `https://${announce}`





// Вкладки: заявка, деньги и история — три разных разговора, и держать их
// на одном полотне значит прятать решение совета под таблицами.
const activeTab = ref('about')

const subscriptionsCount = computed(() => row.value?.subscriptions?.length || 0)

const tabs = computed<PageTab[]>(() => [
  { key: 'about', label: t('union.cooperativeDetail.tab.description') },
  { key: 'subscriptions', label: t('union.cooperativeDetail.tab.subscriptions'), count: row.value?.tariff ? undefined : subscriptionsCount.value || undefined },
  { key: 'prices', label: t('union.cooperativeDetail.tab.prices'), count: coopPrices.value.length || undefined },
  { key: 'wallets', label: t('union.cooperativeDetail.tab.wallets') },
  { key: 'payments', label: t('union.cooperativeDetail.tab.payments') },
])

// Индивидуальные цены кооператива: счётчик вкладки и отметка строк тарифа.
// Список ведёт провайдер; после назначения на вкладке карточка перечитывается.
const pricesCard = ref<InstanceType<typeof CoopPricesCard> | null>(null)
const { prices: coopPrices } = useCoopPrices(() => coopname.value)
const individualPriceOf = (code: string): number | null =>
  coopPrices.value.find((p) => p.code === code)?.amount_per_month ?? null

/** Тип документа берём из расширения файла — иконку рисует канон-компонент. */
const charterDocument = computed(() => {
  const charter = row.value?.charter
  if (!charter) return undefined
  const name = charter.original_filename || t('union.cooperativeDetail.charterTitle')
  const ext = name.split('.').pop()?.toLowerCase()
  const type = ext === 'docx' || ext === 'doc' ? 'docx' : ext === 'html' ? 'html' : ext === 'txt' ? 'txt' : 'pdf'
  return {
    type: type as 'docx' | 'pdf' | 'html' | 'txt',
    title: name,
    description: t('union.cooperativeDetail.charterAttached', { date: formatDateTime(String(charter.uploaded_at)), size: formatFileSize(charter.size_bytes) }),
  }
})


const goBack = () => {
  const params = { ...route.params }
  delete (params as any).detailCoopname
  router.push({ name: 'union-cooperatives', params })
}

</script>

<style scoped>
.coop-detail__back {
  margin-bottom: var(--p-3);
}
.coop-detail__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}
.coop-detail__title {
  flex: 1;
  min-width: 0;
}
.coop-detail__name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.coop-detail__domain {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  margin-top: var(--p-2);
  color: var(--p-primary);
  text-decoration: none;
  font-size: var(--p-fs-body-sm);
}
.coop-detail__domain:hover {
  text-decoration: underline;
}
.coop-detail__tariff {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  margin-top: var(--p-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
}
.coop-detail__tariff .q-icon {
  color: var(--p-ink-3);
}
.coop-detail__list-price {
  margin-left: var(--p-2);
  text-decoration: line-through;
}
.coop-detail__tariff-note {
  margin: var(--p-2) 0 var(--p-4);
}
.coop-detail__decision {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.coop-detail__section {
  margin-top: var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.coop-detail__about {
  margin: 0 0 var(--p-4);
  color: var(--p-ink-1);
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  white-space: pre-line;
}
.coop-detail__charter-missing {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  color: var(--p-ink-2);
}
.coop-detail__tabs {
  margin-top: var(--p-4);
}
.coop-detail__payment-error {
  margin-top: var(--p-1);
  color: var(--p-neg);
  overflow-wrap: anywhere;
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
