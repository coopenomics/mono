<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Пополнение пула программных расходов',
  size='sm',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .topup-form
    .topup-form__field
      AmountInput(
        v-model='amount',
        label='Сумма пополнения',
        :symbol='symbol',
        :precision='precision',
        :placeholder='placeholder'
      )
    .topup-form__note.t-sm.t-muted Деньги переводятся из свободных инвестиций программы в пул, из которого оплачиваются программные расходы.

  template(#footer)
    .topup-form__actions
      BaseButton(variant='ghost', @click='close') Отмена
      BaseButton(
        variant='primary',
        :loading='submitting',
        :disabled='!canSubmit',
        @click='submit'
      ) Пополнить
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { useTopupProgramExpensePool } from '../model';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'topped-up'): void;
}>();

const system = useSystemStore();
const { submitTopup } = useTopupProgramExpensePool();

const amount = ref<number | null>(null);
const submitting = ref(false);

const symbol = computed(() => system.info?.symbols?.root_govern_symbol ?? 'RUB');
const precision = computed(() => system.info?.symbols?.root_govern_precision ?? 2);
const placeholder = computed(() => '10000');

const canSubmit = computed(() => amount.value != null && amount.value > 0);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (amount.value == null) return;
  try {
    submitting.value = true;
    await submitTopup(String(amount.value));
    SuccessAlert('Пул пополнен — средства переведены в пул программных расходов');
    emit('topped-up');
    amount.value = null;
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.topup-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.topup-form__field {
  max-width: 240px;
}

.topup-form__note {
  margin: 0;
}

.topup-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
