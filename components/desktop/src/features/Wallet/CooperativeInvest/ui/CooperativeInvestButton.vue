<template>
  <BaseButton variant="primary" @click="showDialog = true">
    <q-icon name="trending_up" class="q-mr-sm" />
    Инвестировать
  </BaseButton>

  <BaseDialog
    v-model="showDialog"
    title="Заявление об инвестировании"
    size="md"
    @update:model-value="(v) => !v && clear()"
  >
    <div class="banner banner--info q-mb-md">
      <q-icon name="info" class="banner__icon" />
      <div class="banner__body">
        Заявление об инвестировании средств кооператива в ЦПП
        «{{ programName }}» оператора будет отправлено в совет кооператива.
        После одобрения советом кассир получит исходящий платёж на реквизиты
        оператора, а после оплаты будет выполнена проводка Дт 58 / Кт 51.
      </div>
    </div>

    <BaseForm :loading="isSubmitting" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="quantity"
        label="Сумма инвестирования"
        type="number"
        :suffix="currency"
        :error="quantityError"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="isSubmitting"
        :disabled="!isFormValid"
      >
        Подписать и отправить в совет
      </BaseButton>
    </BaseForm>
  </BaseDialog>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { env } from 'src/shared/config';
import { useCooperativeInvest } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api';

const emit = defineEmits<{ (e: 'created', invest_hash: string): void }>();

const { processCooperativeInvest } = useCooperativeInvest();

const showDialog = ref(false);
const quantity = ref<string | number | null>(null);
const isSubmitting = ref(false);
const errorMessage = ref('');

const currency = computed(() => env.CURRENCY as string);
const programName = 'Благорост';

const quantityError = computed(() => {
  if (quantity.value === null || quantity.value === '') return '';
  return Number(quantity.value) > 0 ? '' : 'Сумма должна быть больше нуля';
});

const isFormValid = computed(
  () => quantity.value !== null && quantity.value !== '' && Number(quantity.value) > 0,
);

function clear() {
  quantity.value = null;
  errorMessage.value = '';
}

async function submit() {
  if (!isFormValid.value || isSubmitting.value) return;
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const result = await processCooperativeInvest({
      quantity: Number(quantity.value),
      symbol: currency.value,
    });
    SuccessAlert('Заявление отправлено в совет кооператива');
    showDialog.value = false;
    clear();
    emit('created', result.invest_hash);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    errorMessage.value = message;
    FailAlert(e);
  } finally {
    isSubmitting.value = false;
  }
}
</script>
