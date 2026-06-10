<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton } from 'src/shared/ui/base'
import { AmountInput, DataRow, PageHint } from 'src/shared/ui/domain'
import { getEconomyConfig, setMembershipFee } from '../api'

/**
 * Стол администратора → «Экономика» (requirement b6): единая ставка
 * членского взноса кооператива. Одна ставка на все кооперативные участки —
 * против спекуляций и конкуренции между ними; задаётся транзакцией и
 * применяется к заказам, созданным после установки.
 */

const loading = ref(false)
const saving = ref(false)
const currentPercent = ref(0)
const draftPercent = ref<number>(0)

const changed = computed(() => Number(draftPercent.value) !== currentPercent.value)

async function load(): Promise<void> {
  loading.value = true
  try {
    const config = await getEconomyConfig()
    currentPercent.value = config.membership_fee_percent
    draftPercent.value = config.membership_fee_percent
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить ставку членского взноса')
  } finally {
    loading.value = false
  }
}

async function onSave(): Promise<void> {
  saving.value = true
  try {
    const config = await setMembershipFee({ membership_fee_percent: Number(draftPercent.value) })
    currentPercent.value = config.membership_fee_percent
    draftPercent.value = config.membership_fee_percent
    SuccessAlert('Ставка членского взноса установлена')
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
    | Членский взнос добавляется к стоимости каждого заказа Стола заказов и
    | после исполнения заказа распределяется кооперативному участку выдачи.
    | Ставка единая для всех участков и категорий — так исключаются
    | спекуляции и переток заказов между участками. Изменение действует на
    | заказы, созданные после установки.

  .admin-economy__rows
    DataRow(label='Действующая ставка', :value='currentPercent.toFixed(2) + " %"')

  .admin-economy__form
    AmountInput.admin-economy__input(
      v-model='draftPercent',
      label='Новая ставка членского взноса',
      symbol='%',
      :precision='2',
      :min='0',
      :max='100'
    )
    BaseButton(
      variant='primary',
      :loading='saving',
      :disabled='!changed',
      @click='onSave'
    ) Установить
</template>

<style scoped lang="scss">
.admin-economy {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__rows {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-2, 8px) var(--p-4, 16px);
    max-width: 520px;
  }

  &__form {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__input {
    max-width: 280px;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .admin-economy {
    padding: var(--p-4, 16px);
  }
}
</style>
