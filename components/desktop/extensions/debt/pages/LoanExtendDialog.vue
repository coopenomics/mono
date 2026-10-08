<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  :title='$t("debt.extendDialog.title")',
  size='sm',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .extend-form(v-if='loan')
    BaseInput(
      v-model='due',
      type='date',
      :label='$t("debt.extendDialog.dueLabel")',
      :hint='$t("debt.extendDialog.dueHint", { date: formatDate(loan.due_at) })',
      required
    )
    p.loan-form__terms {{ $t('debt.extendDialog.terms') }}

  template(#footer)
    .extend-form__footer
      BaseButton(variant='ghost', @click='close') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='submitting', :disabled='!canSubmit', @click='submit') {{ $t('debt.extendDialog.submitLabel') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import type { ILoan } from '../api';
import { defaultDueDate, formatDate, useLoanActions } from '../model';
import { t } from '../i18n';

const props = defineProps<{ modelValue: boolean; loan: ILoan | null }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'extended'): void;
}>();

const { extend } = useLoanActions();

const submitting = ref(false);
const due = ref('');

// Новый срок позже сегодняшнего дня и позже действующего срока.
const today = new Date().toISOString().slice(0, 10);
const currentDue = computed(() => String(props.loan?.due_at ?? '').slice(0, 10));
const canSubmit = computed(() => due.value > today && due.value > currentDue.value && !submitting.value);

watch(
  () => props.modelValue,
  (open) => {
    // По умолчанию — шесть месяцев от сегодняшнего дня; если действующий срок позже, поле остаётся пустым.
    if (open) due.value = defaultDueDate() > currentDue.value ? defaultDueDate() : '';
  },
  { immediate: true },
);

function close(): void {
  emit('update:modelValue', false);
}

async function submit(): Promise<void> {
  if (!props.loan) return;
  try {
    submitting.value = true;
    await extend(props.loan.debt_hash, due.value);
    SuccessAlert(t('debt.extendDialog.submittedMessage'));
    emit('extended');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.extend-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.loan-form__terms {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.extend-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>
