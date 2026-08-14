<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { AmountInput, PageHint } from 'src/shared/ui/domain'
import { getEconomyConfig, setMembershipFee } from '../api'

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

onMounted(() => void load())
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
