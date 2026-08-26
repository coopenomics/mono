<template lang="pug">
.payments-history
  BaseBanner(v-if="error" variant="neg") {{ error }}

  BaseCard(:variant="title ? 'default' : 'flat'" :title="title" :subtitle="subtitle")
    EmptyState(
      v-if="!loading && !payments.length"
      title="Списаний ещё не было"
      body="Здесь появятся списания за подписки: хаб списывает их с кошелька кооператива по расписанию"
    )
      template(#icon)
        q-icon(name="history" size="28px")

    BaseTable(
      v-else
      :columns="columns"
      :rows="payments"
      :loading="loading"
      row-key="payment_hash"
      min-width="520px"
    )
      template(#cell-date="{ row: payment }")
        span.t-mono {{ formatDateTime(payment.created_at) }}
      template(#cell-amount="{ row: payment }")
        span.t-mono {{ formatAsset2Digits(payment.quantity) }}
      template(#cell-status="{ row: payment }")
        BaseChip(:variant="paymentStatusVariant(payment.status)" size="sm")
          span {{ paymentStatusLabel(payment.status) }}
        //- Причина отказа — рядом со статусом: без неё «отклонено» не говорит
        //- ничего, а отдельной колонки текст не стоит.
        .payments-history__error.t-meta(v-if="payment.last_error") {{ payment.last_error }}
      template(#cell-tx="{ row: payment }")
        //- Идентификатор без ссылки: обозревателя транзакций в интерфейсе пока
        //- нет, а полное значение отдаём подсказкой — по нему сверяют списание
        //- с цепью.
        span.t-mono(v-if="payment.tx_id")
          | {{ payment.tx_id.slice(0, 8) }}…
          q-tooltip {{ payment.tx_id }}
        span.t-muted(v-else) —
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import moment from 'src/shared/lib/utils/dates/moment'
import { BaseBanner, BaseCard, BaseChip, BaseTable, EmptyState } from 'src/shared/ui/base'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { paymentStatusLabel, paymentStatusVariant } from 'src/entities/Union'
import { useLoadCooperativePayments } from 'src/features/Union/LoadCooperativePayments'

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

const columns = [
  { key: 'date', label: 'Когда', align: 'left' as const },
  { key: 'amount', label: 'Сумма', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Состояние', align: 'left' as const },
  { key: 'tx', label: 'Транзакция', align: 'right' as const },
]

const formatDateTime = (d: string) => moment(d).format('DD.MM.YY HH:mm')

const load = () => {
  if (props.coopname) void loadPayments(props.coopname, props.limit)
}

onMounted(load)
watch(() => props.coopname, load)
</script>

<style scoped>
.payments-history__error {
  color: var(--p-neg);
  margin-top: 2px;
}
</style>
