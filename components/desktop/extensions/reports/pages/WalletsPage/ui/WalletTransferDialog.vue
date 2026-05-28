<template lang="pug">
BaseDialog(
  :model-value='modelValue'
  @update:model-value='emit("update:modelValue", $event)'
  size='lg'
  title='Перевод между кошельками'
  :close-on-backdrop='!loading'
  :close-on-escape='!loading'
)
  p.transfer-dialog__lead
    | Перевод между кошельками одного бухгалтерского счёта без изменения сальдо счёта.
    | Доступен только председателю.

  q-form(@submit.prevent='submit' ref='formRef' greedy)
    q-select.q-mb-sm(
      v-model='form.fromWallet'
      :options='fromOptions'
      option-label='label'
      option-value='id'
      emit-value map-options
      label='Из кошелька'
      outlined dense
      :disable='!!props.fixedFromWallet'
      :rules='[(v) => !!v || "Выберите кошелёк-источник"]'
      @update:model-value='onFromChange'
    )
      template(#option='scope')
        q-item(v-bind='scope.itemProps')
          q-item-section
            q-item-label {{ scope.opt.label }}
            q-item-label(caption) Доступно: {{ scope.opt.available }}

    q-select.q-mb-sm(
      v-model='form.toWallet'
      :options='toOptions'
      option-label='label'
      option-value='id'
      emit-value map-options
      label='В кошелёк'
      outlined dense
      :disable='!form.fromWallet'
      :hint='toHint'
      :rules='[(v) => !!v || "Выберите кошелёк-получатель", (v) => v !== form.fromWallet || "Источник и получатель не должны совпадать"]'
    )
      template(#option='scope')
        q-item(v-bind='scope.itemProps')
          q-item-section
            q-item-label {{ scope.opt.label }}
            q-item-label(caption) Доступно: {{ scope.opt.available }}
      //- Причина пустого списка важнее, чем «No results» по дефолту:
      //- walmove ходит ТОЛЬКО внутри одного бух.счёта, поэтому если у
      //- кооператива нет других кошельков на том же счёте — выбора нет.
      template(#no-option)
        q-item
          q-item-section.text-italic.caption-muted
            | Нет других кошельков на бух.счёте {{ accountIdLabel }}.
            | Перевод между разными счетами требует решения совета.

    .row.items-center.q-gutter-sm.q-mb-sm(v-if='form.fromWallet')
      .col
        .text-caption.caption-muted Бух.счёт
        .text-body2.text-weight-medium {{ accountIdLabel }}

    q-input.q-mb-sm(
      v-model='form.amountStr'
      label='Сумма (RUB)'
      outlined dense type='number' step='0.0001' min='0.0001'
      :rules='[validateAmount]'
      hint='До 4 знаков после запятой'
    )

    q-input.q-mb-sm(
      v-model='form.memo'
      label='Обоснование'
      outlined dense type='textarea' rows='3' counter maxlength='255'
      :rules='[(v) => (v && v.trim().length > 0) || "Обязательно — укажите причину перевода"]'
    )

  template(#footer)
    BaseButton(variant='ghost' :disabled='loading' @click='close') Отмена
    BaseButton(variant='primary' :loading='loading' @click='submit')
      template(#icon-left)
        q-icon.q-mr-xs(name='fa-solid fa-arrow-right-arrow-left' size='15px')
      | Перевести
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Ledger2 } from 'cooptypes'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSystemStore } from 'src/entities/System/model'
import { useLedger2Store, type ILedger2Wallet } from 'src/entities/Ledger2'
import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
import { BaseButton } from 'src/shared/ui/base/BaseButton'

interface Props {
  modelValue: boolean
  /** Если задано — диалог открыт «из строки кошелька»: from_wallet залочен.
   * Значение — eosio::name кошелька (`w.<contract>.<waltype>`). */
  fixedFromWallet?: string | null
  /** Список кошельков для выбора (общекооперативные ledger2 wallets). */
  wallets: ILedger2Wallet[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', payload: { processHash: string }): void
}>()

const { info } = useSystemStore()
const ledger2Store = useLedger2Store()

const formRef = ref<{ validate: () => Promise<boolean> } | null>(null)
const loading = ref(false)

const form = reactive({
  fromWallet: null as string | null,
  toWallet: null as string | null,
  amountStr: '',
  memo: '',
})

/**
 * Привязка wallet→account по cooptypes (LEDGER2_OPERATION_REGISTRY).
 * Та же логика, что в backend: первая стандартная операция, где встречается
 * этот кошелёк, даёт его account_id (debit/credit зависит от роли).
 *
 * `walletName` — eosio::name кошелька (`w.<contract>.<waltype>`).
 */
function resolveAccountId(walletName: string): number | null {
  for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
    if (op.kind === 'adjustment') continue
    if (op.debit === null && op.credit === null) continue
    if (op.wallet_from === walletName && op.credit !== null) return op.credit
    if (op.wallet_to === walletName && op.wallet_op === 'ISSUE' && op.credit !== null) return op.credit
    if (op.wallet_to === walletName && op.debit !== null) return op.debit
    if (op.wallet_from === walletName && op.debit !== null) return op.debit
  }
  // Fallback: TRANSFER без бухпроводок (debit==null && credit==null), напр. o.cap.invest —
  // привязка кошелька к счёту резолвится через парный кошелёк операции.
  for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
    if (op.kind === 'adjustment') continue
    if (op.debit !== null || op.credit !== null) continue
    if (op.wallet_from === walletName && op.wallet_to !== null) return resolveAccountId(op.wallet_to)
    if (op.wallet_to === walletName && op.wallet_from !== null) return resolveAccountId(op.wallet_from)
  }
  return null
}

const fromOptions = computed(() =>
  props.wallets.map((w) => ({
    id: w.id,
    label: `${w.id} · ${w.name}`,
    available: w.available,
  })),
)

const sourceAccountId = computed(() => (form.fromWallet ? resolveAccountId(form.fromWallet) : null))

const accountIdLabel = computed(() => {
  if (!sourceAccountId.value) return '—'
  const code = Math.floor(sourceAccountId.value / 1000)
  return `${sourceAccountId.value} (${code})`
})

const toOptions = computed(() => {
  if (!sourceAccountId.value) return []
  return props.wallets
    .filter((w) => w.id !== form.fromWallet && resolveAccountId(w.id) === sourceAccountId.value)
    .map((w) => ({
      id: w.id,
      label: `${w.id} · ${w.name}`,
      available: w.available,
    }))
})

const toHint = computed(() => {
  if (!form.fromWallet) return ''
  const n = toOptions.value.length
  if (n === 0) return 'На этом бух.счёте нет других кошельков'
  return `Доступно ${n} ${n === 1 ? 'кошелёк' : n < 5 ? 'кошелька' : 'кошельков'} на счёте`
})

function onFromChange() {
  // Сброс получателя при смене источника, чтобы не остался кошелёк другого счёта.
  form.toWallet = null
}

function validateAmount(value: string): true | string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 'Сумма должна быть положительной'
  // Доступно у источника
  if (form.fromWallet) {
    const wallet = props.wallets.find((w) => w.id === form.fromWallet)
    const avail = wallet ? Number.parseFloat(String(wallet.available).split(' ')[0] ?? '0') : 0
    if (n > avail) return `Недостаточно средств (доступно ${avail})`
  }
  return true
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.fromWallet = props.fixedFromWallet ?? null
      form.toWallet = null
      form.amountStr = ''
      form.memo = ''
    }
  },
)

async function submit() {
  if (loading.value) return
  // Кнопка «Перевести» теперь в footer диалога (вне q-form), поэтому
  // валидацию правил полей запускаем явно перед отправкой.
  const valid = await formRef.value?.validate()
  if (!valid) return
  if (!form.fromWallet || !form.toWallet) return
  if (!sourceAccountId.value) {
    FailAlert(new Error('Не удалось определить бух.счёт для выбранного кошелька'))
    return
  }
  loading.value = true
  try {
    const result = await ledger2Store.walmoveWallets({
      coopname: info.coopname,
      // Для общекооперативных кошельков владелец = coopname.
      username: info.coopname,
      fromWallet: form.fromWallet,
      toWallet: form.toWallet,
      quantity: `${Number(form.amountStr).toFixed(4)} RUB`,
      memo: form.memo.trim(),
    })
    SuccessAlert('Перевод выполнен')
    emit('success', { processHash: result.processHash })
    // Закрываем явно (не через close(), чтобы не цеплять guard на loading,
    // который ещё true до finally).
    emit('update:modelValue', false)
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

/** Кнопка «Отмена» / крестик — блокируем во время идущей мутации. */
function close() {
  if (loading.value) return
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.transfer-dialog__lead {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
}
// Канон-токен --p-ink-2 сам адаптируется к тёмной теме — без rgba-хардкода.
.caption-muted {
  color: var(--p-ink-2);
}
</style>
