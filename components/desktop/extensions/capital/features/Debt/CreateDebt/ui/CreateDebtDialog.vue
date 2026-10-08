<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("capital.createDebtDialog.title")',
  size='md',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .debt-form
    AmountInput(
      v-model='form.amount',
      :symbol='symbol',
      :precision='precision',
      :label='$t("capital.createDebtDialog.amountLabel")',
      :hint='$t("capital.createDebtDialog.amountHint")',
      :balance='available',
      :max='available',
      show-balance,
      show-max
    )
    BaseInput(
      v-model='form.due',
      type='date',
      :label='$t("capital.createDebtDialog.dueLabel")',
      required
    )
    PaymentMethodSelect(
      v-model='form.method_id',
      :username='session.username',
      :label='$t("capital.createDebtDialog.methodLabel")',
      required
    )
    BaseBanner(variant='info') {{ $t('capital.createDebtDialog.terms') }}

  template(#footer)
    .debt-form__footer
      BaseButton(variant='ghost', @click='close') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='submitting', :disabled='!canSubmit', @click='submit') {{ $t('capital.createDebtDialog.submitLabel') }}
</template>

<script setup lang="ts">
// realtime: нет источника — окно работает с суммой, переданной карточкой доли
import { computed, reactive, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect';
import { useCreateDebt } from '../model';
import { t } from '../../../../i18n';

const props = defineProps<{
  modelValue: boolean;
  /** Проект, под долю в котором берётся заём. */
  projectHash: string;
  /** Доступно под заём: обеспеченная сумма доли за вычетом уже взятого. */
  available: number;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const system = useSystemStore();
const session = useSessionStore();
const { createDebt } = useCreateDebt();

const symbol = computed(() => system.governSymbol);
const precision = computed(() => system.governPrecision);

// Срок по умолчанию — шесть месяцев от сегодняшнего дня.
function defaultDue(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 6);
  return date.toISOString().slice(0, 10);
}

const submitting = ref(false);
const form = reactive({
  amount: null as number | null,
  due: defaultDue(),
  method_id: null as string | null,
});

const today = new Date().toISOString().slice(0, 10);
const canSubmit = computed(
  () =>
    form.amount !== null &&
    form.amount > 0 &&
    form.amount <= props.available &&
    form.due > today &&
    Boolean(form.method_id) &&
    !submitting.value,
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (form.amount === null || !form.method_id) return;
  try {
    submitting.value = true;
    await createDebt({
      project_hash: props.projectHash,
      amount: form.amount,
      symbol: symbol.value,
      precision: precision.value,
      due: form.due,
      method_id: form.method_id,
    });
    SuccessAlert(t('capital.createDebtDialog.submittedMessage'));
    form.amount = null;
    emit('created');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.debt-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.debt-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
