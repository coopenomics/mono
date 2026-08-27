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
      min-width="560px"
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

// Идентификатора транзакции здесь нет намеренно (@ant 2026-08-27): обозревателя
// цепи в интерфейсе нет, ссылкой хэш не станет, а пайщику он ничего не говорит —
// колонка только съедала ширину у причины отказа. Значение остаётся в журнале.
const columns = [
  { key: 'date', label: 'Когда', align: 'left' as const },
  { key: 'subject', label: 'За что', align: 'left' as const },
  { key: 'amount', label: 'Сумма', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Состояние', align: 'left' as const, width: '38%' },
]

const formatDateTime = (d: string) => moment(d).format('DD.MM.YY HH:mm')

const load = () => {
  if (props.coopname) void loadPayments(props.coopname, props.limit)
}

onMounted(load)
watch(() => props.coopname, load)
</script>

<style scoped>
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
