<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Вернуть средства в программу',
  size='sm',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .deallocate-form
    DataRow(label='Компонент', :value='componentTitle')

    .deallocate-form__limit
      DataRow(label='Доступно к возврату', :value='maxLabel')
      .deallocate-form__hint.t-sm.t-muted {{ limitHint }}

    .deallocate-form__field
      AmountInput(
        v-model='amount',
        label='Сумма',
        :symbol='symbol',
        :precision='DISPLAY_PRECISION',
        :balance='maxAmount',
        :max='maxAmount',
        :disabled='loadingLimit || maxAmount <= 0',
        show-balance,
        show-max
      )

    .deallocate-form__note.t-sm.t-muted Сумма вернётся в свободный остаток программы. Доли участников в компоненте пересчитаются: доступные им суммы уменьшатся пропорционально.

  template(#footer)
    .deallocate-form__actions
      BaseButton(variant='ghost', @click='close') Отмена
      BaseButton(
        variant='primary',
        :loading='submitting',
        :disabled='!canSubmit',
        @click='submit'
      ) Вернуть
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useDeallocateFunds } from '../model';
import type { IDeallocationLimit } from 'app/extensions/capital/entities/Invest/model/types';

/** Суммы показываем в рублях с копейками — точность ассета цепи это деталь хранения. */
const DISPLAY_PRECISION = 2;

const props = defineProps<{
  modelValue: boolean;
  /** Компонент, из которого возвращаем средства */
  projectHash: string;
  componentTitle: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'deallocated'): void;
}>();

const system = useSystemStore();
const { fetchLimit, submitDeallocation } = useDeallocateFunds();

const amount = ref<number | null>(null);
const submitting = ref(false);
const loadingLimit = ref(false);
const limit = ref<IDeallocationLimit | null>(null);

const symbol = computed(() => system.info?.symbols?.root_govern_symbol ?? 'RUB');

function assetToNumber(asset?: string | null): number {
  if (!asset) return 0;
  const numeric = Number.parseFloat(String(asset).split(' ')[0] ?? '');
  return Number.isNaN(numeric) ? 0 : numeric;
}

const maxAmount = computed(() => assetToNumber(limit.value?.max_amount));

const maxLabel = computed(() => {
  if (loadingLimit.value) return 'Считаем…';
  return formatAsset2Digits(limit.value?.max_amount ?? '0.0000');
});

/**
 * Объясняем, чем ограничена сумма: «больше нельзя, потому что участникам уже
 * выданы ссуды» читается иначе, чем «больше в компонент и не направляли».
 */
const limitHint = computed(() => {
  if (loadingLimit.value || !limit.value) return ' ';

  if (!limit.value.is_allowed_by_status)
    return 'Возврат недоступен: компонент уже ушёл на голосование или завершён.';

  if (maxAmount.value <= 0) return 'Возвращать нечего: средства компонента израсходованы.';

  if (assetToNumber(limit.value.outstanding_debt) > 0)
    return `Часть средств удерживается под непогашенные ссуды участников — ${formatAsset2Digits(limit.value.outstanding_debt)}.`;

  return ' ';
});

const canSubmit = computed(
  () =>
    !loadingLimit.value &&
    amount.value != null &&
    amount.value > 0 &&
    amount.value <= maxAmount.value,
);

async function loadLimit(): Promise<void> {
  try {
    loadingLimit.value = true;
    limit.value = await fetchLimit(props.projectHash);
  } catch (e) {
    FailAlert(e);
  } finally {
    loadingLimit.value = false;
  }
}

// Диалог переиспользуется — при открытии тянем актуальный предел, при закрытии
// сбрасываем ввод, чтобы следующее открытие не подставило прошлую сумму.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      amount.value = null;
      limit.value = null;
      void loadLimit();
    } else {
      amount.value = null;
    }
  },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (amount.value == null) return;
  try {
    submitting.value = true;
    await submitDeallocation(props.projectHash, String(amount.value));
    SuccessAlert('Средства возвращены в программу');
    emit('deallocated');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.deallocate-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.deallocate-form__field {
  max-width: 240px;
}

.deallocate-form__hint {
  /* резервируем строку, чтобы подсказка не сдвигала форму при появлении */
  min-height: 20px;
  margin: 0;
}

.deallocate-form__note {
  margin: 0;
}

.deallocate-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
