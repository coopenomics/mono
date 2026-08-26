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

    //- ─────────────── Описание ───────────────
    .coop-detail__section(v-if="activeTab === 'about'")
      BaseCard(variant="flat")
        p.coop-detail__about(v-if="row.description") {{ row.description }}
        p.coop-detail__about.t-muted(v-else) Описание не заполнено.

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
              | Открыть устав
        .coop-detail__charter-missing(v-else)
          q-icon(name="warning" size="20px")
          span.t-sm.t-muted Устав не приложен.

    //- ─────────────── Подписки ───────────────
    .coop-detail__section(v-else-if="activeTab === 'subscriptions'")
      BaseCard(variant="flat")
        EmptyState(
          v-if="!subscriptionsCount"
          title="Подписок нет"
          body="Появятся, когда провайдер начнёт поставку инфраструктуры"
        )
          template(#icon)
            q-icon(name="receipt_long" size="48px")
        BaseTable(
          v-else
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

    //- ─────────────── Кошельки ───────────────
    .coop-detail__section(v-else-if="activeTab === 'wallets'")
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
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert } from 'src/shared/api/alerts'

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
    else FailAlert('Ссылка на устав недоступна')
  } catch (e: any) {
    FailAlert(e)
  } finally {
    charterOpening.value = false
  }
}

const formatFileSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`
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
  { key: 'about', label: 'Описание' },
  { key: 'subscriptions', label: 'Подписки', count: subscriptionsCount.value || undefined },
  { key: 'wallets', label: 'Кошельки' },
  { key: 'payments', label: 'История оплат' },
])

/** Тип документа берём из расширения файла — иконку рисует канон-компонент. */
const charterDocument = computed(() => {
  const charter = row.value?.charter
  if (!charter) return undefined
  const name = charter.original_filename || 'Устав кооператива'
  const ext = name.split('.').pop()?.toLowerCase()
  const type = ext === 'docx' || ext === 'doc' ? 'docx' : ext === 'html' ? 'html' : ext === 'txt' ? 'txt' : 'pdf'
  return {
    type: type as 'docx' | 'pdf' | 'html' | 'txt',
    title: name,
    description: `Приложен ${formatDateTime(charter.uploaded_at)} · ${formatFileSize(charter.size_bytes)}`,
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
