<template>
  <BaseDialog
    :model-value="modelValue"
    title="Паспортные данные"
    size="md"
    :close-on-backdrop="false"
    @update:model-value="onToggle"
  >
    <BaseForm :loading="saving" @submit="submit">
      <p class="t-sm t-muted q-mb-md">
        Для договора о полной индивидуальной материальной ответственности нужны ваши
        паспортные данные. Они сохранятся в вашем профиле пайщика и будут использоваться
        повторно.
      </p>

      <BaseInput v-model="series" label="Серия паспорта" type="number" required />
      <BaseInput v-model="number" label="Номер паспорта" type="number" required />
      <BaseInput v-model="issuedBy" label="Кем выдан" required />
      <BaseInput v-model="issuedAt" label="Дата выдачи" type="date" required />
      <BaseInput v-model="code" label="Код подразделения" placeholder="220-220" required />

      <template #footer="{ loading }">
        <BaseButton variant="ghost" :disabled="loading" @click="cancel">Отмена</BaseButton>
        <BaseButton type="submit" variant="primary" :loading="loading">
          Сохранить и продолжить
        </BaseButton>
      </template>
    </BaseForm>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseDialog, BaseForm, BaseInput, BaseButton } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { api } from 'src/entities/Account/api';
import { SuccessAlert, FailAlert } from 'src/shared/api';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const session = useSessionStore();

const series = ref<string | number | null>('');
const number = ref<string | number | null>('');
const issuedBy = ref('');
const issuedAt = ref('');
const code = ref('');
const saving = ref(false);

function reset(): void {
  series.value = '';
  number.value = '';
  issuedBy.value = '';
  issuedAt.value = '';
  code.value = '';
}

function onToggle(value: boolean): void {
  emit('update:modelValue', value);
  if (!value) reset();
}

function cancel(): void {
  emit('update:modelValue', false);
  reset();
}

async function submit(): Promise<void> {
  saving.value = true;
  try {
    const account = await api.saveMyPassport({
      series: Number(series.value),
      number: Number(number.value),
      issued_by: issuedBy.value,
      issued_at: issuedAt.value,
      code: code.value,
    });
    session.setCurrentUserAccount(account);
    SuccessAlert('Паспортные данные сохранены');
    emit('saved');
    emit('update:modelValue', false);
    reset();
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}
</script>
