<template lang="pug">
.payments-history
  BaseBanner(v-if="error" variant="neg") {{ error }}

  BaseCard(:variant="title ? 'default' : 'flat'" :title="title" :subtitle="subtitle")
    EmptyState(
      v-if="!loading && !payments.length"
      :title="$t('billing.paymentsHistory.emptyTitle')"
      :body="$t('billing.paymentsHistory.emptyBody')"
    )
      template(#icon)
        q-icon(name="history" size="28px")

    BaseTable(
      v-else
      :columns="columns"
      :rows="payments"
      :loading="loading"
      row-key="payment_hash"
      min-width="560px"
      clickable-rows
      @row-click="openDetails"
    )
      template(#cell-date="{ row: payment }")
        span.t-mono {{ formatDateTime(payment.created_at) }}
      template(#cell-subject="{ row: payment }")
        //- За что списано. У записей, заведённых до появления поля, состава нет —
        //- честнее показать прочерк, чем догадку.
        span(v-if="payment.subject") {{ payment.subject }}
        span.t-muted(v-else) —
      template(#cell-amount="{ row: payment }")
        span.t-mono {{ formatAsset2Digits(payment.quantity) }}
      template(#cell-status="{ row: payment }")
        .payments-history__status
          BaseChip(:variant="paymentStatusVariant(payment.status, Boolean(payment.reason))" size="sm")
            span {{ paymentStatusLabel(payment.status, Boolean(payment.reason)) }}
          //- Причина — рядом со статусом: без неё «отклонено» не говорит ничего.
          //- Текст переносится по строкам целиком: обрезка ровно на «кооперати…»
          //- превращает объяснение в загадку. Отладочный ответ узла сюда не
          //- попадает — он остаётся в журнале, читать его пайщику незачем.
          .payments-history__error.t-meta(v-if="payment.reason") {{ payment.reason }}

  //- Состав списания: сумма, состояние, причина отказа и идентификаторы —
  //- в таблице они только съедали бы ширину.
  DetailsDrawer(
    :model-value="detailsOpen"
    :width="480"
    :title="$t('billing.paymentsHistory.drawer.title')"
    @update:model-value="(v) => { if (!v) detailsOpen = false }"
  )
    .payments-details(v-if="selected")
      .payments-details__head
        BaseChip(:variant="paymentStatusVariant(selected.status, Boolean(selected.reason))" size="sm")
          span {{ paymentStatusLabel(selected.status, Boolean(selected.reason)) }}
        .payments-details__sum.t-mono.t-num {{ formatAsset2Digits(selected.quantity) }}
      .payments-details__rows
        DataRow(:label="$t('billing.paymentsHistory.column.date')" :value="formatDateTime(selected.created_at)" align="spread")
        DataRow(:label="$t('billing.paymentsHistory.column.subject')" :value="selected.subject || '—'" align="vertical")
        DataRow(v-if="selected.reason" :label="$t('billing.paymentsHistory.drawer.reason')" :value="selected.reason" align="vertical")
        DataRow(:label="$t('billing.paymentsHistory.drawer.paymentHash')" :value="selected.payment_hash" mono copyable align="vertical")
        DataRow(v-if="selected.tx_id" :label="$t('billing.paymentsHistory.drawer.txId')" :value="selected.tx_id" mono copyable align="vertical")
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import moment from 'src/shared/lib/utils/dates/moment'
import { BaseBanner, BaseCard, BaseChip, BaseTable, EmptyState } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { paymentStatusLabel, paymentStatusVariant } from 'src/entities/Union'
import { useLoadCooperativePayments } from 'src/features/Union/LoadCooperativePayments'
import { useLiveReload } from 'src/shared/lib/realtime'
import { t } from 'src/shared/i18n';

/**
 * Журнал списаний за подписки: одна и та же таблица нужна и совету в карточке
 * кооператива, и самому кооперативу на дашборде подключения, поэтому она живёт
 * здесь, а не копией в двух страницах.
 *
 * Контракт биллинга on-chain таблиц не ведёт, так что единственная летопись —
 * журнал хаба; показываем и незавершённые попытки: «списание зависло» и
 * «списания не было» — разные вещи.
 */
const props = withDefaults(
  defineProps<{
    coopname: string
    /** Заголовок карточки; без него — плоская карточка без шапки (для вкладки). */
    title?: string
    subtitle?: string
    limit?: number
  }>(),
  { title: '', subtitle: '', limit: undefined },
)

const { payments, loading, error, loadPayments } = useLoadCooperativePayments()

// Идентификатора транзакции здесь нет намеренно (@ant 2026-08-27): обозревателя
// цепи в интерфейсе нет, ссылкой хэш не станет, а пайщику он ничего не говорит —
// колонка только съедала ширину у причины отказа. Значение остаётся в журнале.
const columns = [
  { key: 'date', label: t('billing.paymentsHistory.column.date'), align: 'left' as const },
  { key: 'subject', label: t('billing.paymentsHistory.column.subject'), align: 'left' as const },
  { key: 'amount', label: t('billing.paymentsHistory.column.amount'), align: 'right' as const, numeric: true },
  { key: 'status', label: t('billing.paymentsHistory.column.status'), align: 'left' as const, width: '38%' },
]

const formatDateTime = (d: string) => moment(d).format('DD.MM.YY HH:mm')

const detailsOpen = ref(false)
const selected = ref<any>(null)
const openDetails = (row: any) => {
  selected.value = row
  detailsOpen.value = true
}

const load = () => {
  if (props.coopname) void loadPayments(props.coopname, props.limit)
}

onMounted(load)
watch(() => props.coopname, load)
// Журнал пишет хаб (крон оплаты, слушатель billing::pay) — карточка живёт по его сигналам.
useLiveReload([{ code: 'core', table: 'billing_payment_log' }], async () => load())
</script>

<style scoped>
.payments-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.payments-details__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2);
}
.payments-details__sum {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
}
.payments-details__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.payments-history__status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
  /* Ячейка таблицы не растягивается под содержимое — иначе длинная причина
     тянет строку вширь и вылезает за карточку. */
  max-width: 100%;
}

.payments-history__error {
  color: var(--p-neg);
  /* Причина — предложение целиком, в несколько строк; переносим и по словам,
     и внутри длинного слова, чтобы ничего не уезжало за край. */
  white-space: normal;
  overflow-wrap: anywhere;
  max-width: 100%;
}
</style>
