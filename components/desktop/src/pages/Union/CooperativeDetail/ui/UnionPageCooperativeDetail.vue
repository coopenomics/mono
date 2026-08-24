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
    //- Шапка заявки: кто подал, в каком состоянии и что с этим делать.
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
        BaseButton(
          v-if="!isRegistryStatus(row.status, 'active')"
          variant="primary"
          size="sm"
          type="button"
          :loading="deciding"
          @click="activate"
        ) Подтвердить подключение
        BaseButton(
          v-if="!isRegistryStatus(row.status, 'blocked')"
          variant="secondary"
          size="sm"
          type="button"
          :loading="deciding"
          @click="block"
        ) Заблокировать

    .coop-detail__section
      .coop-detail__section-title Заявка кооператива

      BaseCard(variant="flat")
        //- Рассказ о деятельности и устав — то, по чему совет решает,
        //- подтверждать ли подключение. Оба присланы на первом шаге мастера.
        p.coop-detail__about(v-if="row.description") {{ row.description }}
        p.coop-detail__about.t-muted(v-else) Кооператив не заполнил рассказ о своей деятельности.

        .coop-detail__charter
          template(v-if="row.charter")
            q-icon.coop-detail__charter-icon(name="description" size="24px")
            .coop-detail__charter-body
              .coop-detail__charter-name {{ row.charter.original_filename || 'Устав кооператива' }}
              .t-meta.t-muted Приложен {{ formatDateTime(row.charter.uploaded_at) }} · {{ formatFileSize(row.charter.size_bytes) }}
            BaseButton(
              variant="secondary"
              size="sm"
              type="button"
              :loading="charterOpening"
              @click="openCharter"
            )
              q-icon(name="open_in_new" size="14px").q-mr-xs
              | Открыть устав
          template(v-else)
            q-icon.coop-detail__charter-icon(name="warning" size="20px")
            .coop-detail__charter-body
              .t-sm.t-muted Устав не приложен.

    .coop-detail__section
      .coop-detail__section-title Подписки

      BaseCard(variant="flat")
        EmptyState(
          v-if="!row.subscriptions || !row.subscriptions.length"
          title="Подписок нет"
          body="Появятся, когда провайдер начнёт поставку инфраструктуры"
        )
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

      BaseCard(variant="flat")
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
import Loader from 'src/shared/ui/Loader/Loader.vue'
import { useLoadCooperatives } from 'src/features/Union/LoadCooperatives'
import { cooperativeCharterApi } from 'src/features/Union/UploadCooperativeCharter'
import { useActivateCooperative } from 'src/features/Union/ActivateCooperative'
import { useBlockCooperative } from 'src/features/Union/BlockCooperative'
import { useUnionStore } from 'src/entities/Union/model'
import {
  isRegistryStatus,
  registryStatusLabel,
  registryStatusVariant,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
} from 'src/entities/Union'
import type { ICooperativeRegistryItem } from 'src/entities/Union/model'
import { useCooperativeMainWallet } from 'src/entities/Wallet/model'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

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

// Решение совета — транзакция в цепь; пока она идёт, кнопки показывают загрузку.
const deciding = ref(false)
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





const goBack = () => {
  const params = { ...route.params }
  delete (params as any).detailCoopname
  router.push({ name: 'union-cooperatives', params })
}

const activate = async () => {
  if (!row.value) return
  const { activateCooperative } = useActivateCooperative()
  deciding.value = true
  try {
    await activateCooperative(row.value.coopname)
    await load()
    SuccessAlert('Подключение кооператива подтверждено')
  } catch (e: any) {
    FailAlert(e)
  } finally {
    deciding.value = false
  }
}

const block = async () => {
  if (!row.value) return
  const { blockCooperative } = useBlockCooperative()
  deciding.value = true
  try {
    await blockCooperative(row.value.coopname)
    await load()
    SuccessAlert('Кооператив заблокирован')
  } catch (e: any) {
    FailAlert(e)
  } finally {
    deciding.value = false
  }
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
  margin-top: var(--p-5);
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
.coop-detail__charter {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
.coop-detail__charter-icon {
  color: var(--p-ink-2);
}
.coop-detail__charter-body {
  flex: 1;
  min-width: 0;
}
.coop-detail__charter-name {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
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
