<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Аллоцировать средства в проект',
  size='sm',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .allocate-form
    BaseSelect(
      v-model='projectHash',
      label='Проект или компонент',
      placeholder='Выберите, куда направить средства',
      :options='options'
    )
    .allocate-form__field
      AmountInput(
        v-model='amount',
        label='Сумма',
        :symbol='symbol',
        :precision='precision',
        :balance='available',
        show-balance,
        show-max
      )
    .allocate-form__note.t-sm.t-muted Средства уходят со свободного остатка программы и становятся бюджетом проекта. Неизрасходованный остаток вернётся в программу, когда проект завершится или будет удалён.

  template(#footer)
    .allocate-form__actions
      BaseButton(variant='ghost', @click='close') Отмена
      BaseButton(
        variant='primary',
        :loading='submitting',
        :disabled='!canSubmit',
        @click='submit'
      ) Аллоцировать
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseSelect } from 'src/shared/ui/base/BaseSelect';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { useAllocateFunds } from '../model';

const props = defineProps<{
  modelValue: boolean;
  /** Проекты и компоненты, доступные для направления средств */
  options: BaseSelectOption[];
  /** Свободный остаток программы — потолок суммы */
  available: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'allocated'): void;
}>();

const system = useSystemStore();
const { submitAllocation } = useAllocateFunds();

const projectHash = ref<string | null>(null);
const amount = ref<number | null>(null);
const submitting = ref(false);

const symbol = computed(() => system.info?.symbols?.root_govern_symbol ?? 'RUB');
const precision = computed(() => system.info?.symbols?.root_govern_precision ?? 2);

const canSubmit = computed(
  () =>
    !!projectHash.value &&
    amount.value != null &&
    amount.value > 0 &&
    amount.value <= props.available,
);

// Диалог переиспользуется — при закрытии сбрасываем ввод, чтобы следующее
// открытие не подставило прошлый проект и сумму.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      projectHash.value = null;
      amount.value = null;
    }
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!projectHash.value || amount.value == null) return;
  try {
    submitting.value = true;
    await submitAllocation(projectHash.value, String(amount.value));
    SuccessAlert('Средства направлены в проект');
    emit('allocated');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.allocate-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.allocate-form__field {
  max-width: 240px;
}

.allocate-form__note {
  margin: 0;
}

.allocate-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
