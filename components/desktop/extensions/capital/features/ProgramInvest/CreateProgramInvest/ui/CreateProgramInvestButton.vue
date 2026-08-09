<template lang="pug">
div
  BaseButton(
    variant='primary',
    :loading='isGenerating',
    @click='showDialog = true'
  ) Инвестировать

  BaseDialog(
    v-model='showDialog',
    title='Инвестирование в программу',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    BaseForm(:loading='isGenerating', @submit='handleInvest')
      AmountInput(
        v-model='quantity',
        label='Сумма',
        placeholder='0,00',
        :symbol='currency',
        :precision='2',
        :min='0',
        :error='amountError'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='clear') Отменить
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isGenerating',
          :disabled='!isValidAmount'
        ) Инвестировать
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { BaseButton, BaseDialog, BaseForm } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { useCreateProgramInvest } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';

const { createProgramInvestWithGeneratedStatement, isGenerating } =
  useCreateProgramInvest();
const system = useSystemStore();

// AmountInput эмитит number | null
const quantity = ref<number | string | null>(null);
const showDialog = ref(false);

const currency = computed(
  () => system.info?.symbols?.root_govern_symbol ?? 'GOV',
);

const isValidAmount = computed(() => Number(quantity.value) > 0);

// Ошибку показываем только после ввода, чтобы пустой диалог не открывался красным
const amountError = computed(() =>
  quantity.value != null && quantity.value !== '' && !isValidAmount.value
    ? 'Сумма должна быть положительной'
    : undefined,
);

const clear = (): void => {
  showDialog.value = false;
  quantity.value = '';
};

const handleInvest = async (): Promise<void> => {
  if (!isValidAmount.value) return;
  try {
    await createProgramInvestWithGeneratedStatement(quantity.value!.toString());
    SuccessAlert('Инвестиция принята');
    clear();
  } catch (e: unknown) {
    FailAlert(e);
  }
};
</script>
