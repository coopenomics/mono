<template lang="pug">
.q-pa-sm
  Loader(v-if="loading" :text="'Загрузка биллинга...'")
  div(v-else-if="error")
    q-banner.bg-grey-2 Биллинг недоступен: {{ error }}
  div(v-else-if="summary")
    .row.items-center.q-gutter-md.q-mb-sm
      .text-subtitle2 Сумма к оплате за {{ summary.periodDays }} дн.:
      .text-h6 {{ summary.totalAmount }} {{ summary.currency }}
      q-badge(v-if="summary.totalAmount === 0" color="teal") освобождён/0
      .text-caption(v-if="summary.nextPaymentDue") Следующий платёж: {{ formatDate(summary.nextPaymentDue) }}

    q-list(dense bordered).rounded-borders.q-mb-sm
      q-item(v-for="item in summary.items" :key="item.subscriptionId")
        q-item-section
          q-item-label {{ item.subscriptionTypeName }}
          q-item-label(caption) статус: {{ item.status }}
        q-item-section(side)
          q-badge(v-if="item.isFree" color="teal") free
          span(v-else) {{ item.amount }} {{ summary.currency }}

    q-btn(
      v-if="summary.totalAmount > 0"
      color="primary"
      icon="payments"
      label="Оплатить / Продлить"
      size="sm"
      unelevated
      @click="payDialog = true"
    )

  q-dialog(v-model="payDialog")
    q-card(style="min-width: 360px")
      q-card-section
        .text-subtitle1 Оплата подписок «{{ coopname }}»
      q-card-section
        q-input(
          v-model="payerUsername"
          label="Пайщик-плательщик (владелец биллинг-кошелька)"
          outlined dense
        ).q-mb-sm
        q-input(v-model="memo" label="Назначение платежа" outlined dense)
      q-card-actions(align="right")
        q-btn(flat label="Отмена" v-close-popup)
        q-btn(
          unelevated color="primary" label="Оплатить"
          :loading="paying"
          :disable="!payerUsername"
          @click="onPay"
        )
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import moment from 'src/shared/lib/utils/dates/moment'
import { billingApi, type IBillingSummary } from 'src/entities/Billing'
import { usePaySubscriptions } from 'src/features/Billing/PaySubscriptions'
import { useSystemStore } from 'src/entities/System/model'
import { SuccessAlert, FailAlert } from 'src/shared/api'

const props = defineProps<{ coopname: string }>()

const system = useSystemStore()
const { pay } = usePaySubscriptions()

const summary = ref<IBillingSummary>()
const loading = ref(false)
const error = ref('')

const payDialog = ref(false)
const payerUsername = ref('')
const memo = ref('Оплата инфраструктурных подписок')
const paying = ref(false)

const formatDate = (d: string) => moment(d).format('DD.MM.YYYY')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    summary.value = await billingApi.loadBillingSummary(props.coopname)
  } catch (e: any) {
    error.value = e?.message ?? String(e)
  } finally {
    loading.value = false
  }
}

const onPay = async () => {
  if (!summary.value) return
  paying.value = true
  try {
    const amount = `${summary.value.totalAmount} ${summary.value.currency || system.info.symbols?.root_govern_symbol || 'RUB'}`
    await pay({
      coopname: props.coopname,
      username: payerUsername.value,
      amount,
      paymentHash: summary.value.paymentHash,
      memo: memo.value,
    })
    SuccessAlert('Платёж проведён')
    payDialog.value = false
    await load()
  } catch (e: any) {
    FailAlert(e)
  } finally {
    paying.value = false
  }
}

onMounted(load)
</script>
