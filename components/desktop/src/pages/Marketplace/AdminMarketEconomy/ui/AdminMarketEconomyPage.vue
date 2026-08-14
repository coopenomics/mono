<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { AmountInput, PageHint } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits'
import { getEconomyConfig, getTaxState, payTax, setMembershipFee } from '../api'

/**
 * Стол администратора → «Экономика» (requirement b6): единая ставка
 * членского взноса кооператива. Одна ставка на все кооперативные участки —
 * против спекуляций и конкуренции между ними; задаётся транзакцией и
 * применяется к заказам, созданным после установки.
 *
 * Паттерн «настройка-значение» как в банковских приложениях: значение
 * показывается статичным крупным числом (не полем-инпутом), правка — в
 * отдельном сфокусированном диалоге. Так экран не «прыгает» при переходе
 * просмотр↔правка и не притворяется формой там, где меняют одну цифру.
 */

const loading = ref(false)
const saving = ref(false)
const dialogOpen = ref(false)
const currentPercent = ref(0)
const draftPercent = ref<number>(0)

// Удержанный НДФЛ (решение 2026-08-13). Кооператив — налоговый агент по
// материальной помощи: налог удержан при выплате, но с расчётного счёта не
// ушёл — он висит долгом перед бюджетом. Платится не по каждой выплате, а
// общей суммой за период: бухгалтер отправляет накопленное, кассир платит.
const taxLoading = ref(false)
const taxPaying = ref(false)
const taxDialogOpen = ref(false)
const taxWithheld = ref('')
const taxInPayment = ref('')
const taxAvailable = ref('')
const draftTaxAmount = ref<number>(0)

const displayValue = computed(() => currentPercent.value.toFixed(2).replace('.', ','))
const changed = computed(() => Number(draftPercent.value) !== currentPercent.value)

async function load(): Promise<void> {
  loading.value = true
  try {
    const config = await getEconomyConfig()
    currentPercent.value = config.membership_fee_percent
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить кооперативную наценку')
  } finally {
    loading.value = false
  }
}

function openDialog(): void {
  draftPercent.value = currentPercent.value
  dialogOpen.value = true
}

async function onSave(): Promise<void> {
  saving.value = true
  try {
    const config = await setMembershipFee({ membership_fee_percent: Number(draftPercent.value) })
    currentPercent.value = config.membership_fee_percent
    dialogOpen.value = false
    SuccessAlert('Кооперативная наценка установлена')
  } catch (e) {
    FailAlert(e, 'Не удалось установить ставку')
  } finally {
    saving.value = false
  }
}

function assetToNumber(asset: string): number {
  const parsed = Number.parseFloat((asset || '').split(' ')[0] ?? '0')
  return Number.isFinite(parsed) ? parsed : 0
}

const taxWithheldDisplay = computed(() => formatAsset2Digits(taxWithheld.value || '0.0000 RUB'))
const taxInPaymentDisplay = computed(() => formatAsset2Digits(taxInPayment.value || '0.0000 RUB'))
const taxAvailableDisplay = computed(() => formatAsset2Digits(taxAvailable.value || '0.0000 RUB'))
const taxAvailableAmount = computed(() => assetToNumber(taxAvailable.value))
const hasTaxInPayment = computed(() => assetToNumber(taxInPayment.value) > 0)
const canPayTax = computed(
  () => draftTaxAmount.value > 0 && draftTaxAmount.value <= taxAvailableAmount.value,
)

async function loadTax(): Promise<void> {
  taxLoading.value = true
  try {
    const state = await getTaxState()
    taxWithheld.value = state.withheld
    taxInPayment.value = state.in_payment
    taxAvailable.value = state.available
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить удержанный налог')
  } finally {
    taxLoading.value = false
  }
}

function openTaxDialog(): void {
  // Платят обычно всё накопленное — предзаполняем, но оставляем правку:
  // часть суммы может относиться к следующему сроку перечисления.
  draftTaxAmount.value = taxAvailableAmount.value
  taxDialogOpen.value = true
}

async function onPayTax(): Promise<void> {
  taxPaying.value = true
  try {
    const paid = await payTax({ amount: Number(draftTaxAmount.value) })
    taxDialogOpen.value = false
    SuccessAlert(`Отправлено на оплату: ${formatAsset2Digits(paid)}. Заявка ушла кассиру.`)
    await loadTax()
  } catch (e) {
    FailAlert(e, 'Не удалось отправить налог на оплату')
  } finally {
    taxPaying.value = false
  }
}

onMounted(() => {
  void load()
  void loadTax()
})
</script>

<template lang="pug">
q-page.admin-economy
  PageHint(storage-key='mp:admin-economy:banner-dismissed')
    | Кооперативная наценка добавляется к стоимости каждого заказа Стола заказов и
    | после исполнения заказа распределяется кооперативному участку выдачи.
    | Наценка идёт на обеспечение хозяйственной деятельности кооператива и
    | едина для всех участков и категорий — так исключаются
    | спекуляции и переток заказов между участками. Изменение действует на
    | заказы, созданные после установки.

  .admin-economy__card
    .admin-economy__stat
      .admin-economy__label Кооперативная наценка
      .admin-economy__value
        span.admin-economy__amount {{ displayValue }}
        span.admin-economy__unit %
      .admin-economy__caption на обеспечение хозяйственной деятельности
    BaseButton.admin-economy__edit(
      variant='secondary',
      size='sm',
      :disabled='loading',
      @click='openDialog'
    )
      template(#icon-left)
        q-icon(name='edit', size='16px')
      | Изменить

  .admin-economy__card
    .admin-economy__stat
      .admin-economy__label Удержанный налог к перечислению
      .admin-economy__value
        span.admin-economy__amount {{ taxWithheldDisplay }}
      .admin-economy__caption
        template(v-if='hasTaxInPayment')
          | из них {{ taxInPaymentDisplay }} уже у кассира на оплате
        template(v-else)
          | НДФЛ, удержанный с материальной помощи доверенным
    BaseButton.admin-economy__edit(
      variant='secondary',
      size='sm',
      :disabled='taxLoading || taxAvailableAmount <= 0',
      @click='openTaxDialog'
    )
      template(#icon-left)
        q-icon(name='account_balance', size='16px')
      | Отправить на оплату

  BaseDialog(v-model='taxDialogOpen', title='Перечисление налога в бюджет', size='sm')
    p.admin-economy__dialog-hint
      | Заявка уйдёт кассиру в реестр исходящих платежей — он перечислит сумму
      | по реквизитам налоговой и подтвердит перевод. Доступно к перечислению
      | {{ taxAvailableDisplay }}: больше удержанного отправить нельзя.
    AmountInput(
      v-model='draftTaxAmount',
      label='Сумма платежа',
      symbol='₽',
      :precision='2',
      :min='0',
      :max='taxAvailableAmount',
      :disabled='taxPaying'
    )
    template(#footer)
      BaseButton(variant='ghost', :disabled='taxPaying', @click='taxDialogOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='taxPaying',
        :disabled='!canPayTax',
        @click='onPayTax'
      ) Отправить

  BaseDialog(v-model='dialogOpen', title='Кооперативная наценка', size='sm')
    p.admin-economy__dialog-hint
      | Наценка идёт на обеспечение хозяйственной деятельности кооператива.
      | Новое значение применится к заказам, созданным после сохранения. Уже
      | оформленные заказы не пересчитываются.
    AmountInput(
      v-model='draftPercent',
      label='Наценка',
      symbol='%',
      :precision='2',
      :min='0',
      :max='100',
      :disabled='saving'
    )
    template(#footer)
      BaseButton(variant='ghost', :disabled='saving', @click='dialogOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!changed',
        @click='onSave'
      ) Сохранить
</template>

<style scoped lang="scss">
.admin-economy {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-5, 20px) var(--p-6, 24px);
    max-width: 480px;
  }

  &__label {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    margin-bottom: var(--p-1, 4px);
  }

  &__caption {
    margin-top: var(--p-1, 4px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: var(--p-1, 4px);
    color: var(--p-ink);
  }

  &__amount {
    font-size: var(--p-fs-h1, 24px);
    line-height: var(--p-lh-h1, 1.2);
    letter-spacing: var(--p-ls-h1, -0.018em);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
  }

  &__unit {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 500;
    color: var(--p-ink-2);
  }

  &__edit {
    flex-shrink: 0;
  }

  &__dialog-hint {
    margin: 0;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }
}

@media (max-width: 599px) {
  .admin-economy {
    padding: var(--p-4, 16px);

    &__card {
      max-width: none;
    }
  }
}
</style>
