<template lang="pug">
span
  BaseButton(
    variant='ghost',
    size='sm',
    :loading='isGenerating',
    aria-label='Инвестировать в проект',
    @click.stop='showDialog = true'
  )
    template(#icon-left)
      q-icon(name='add', size='18px')
    | Инвестиция

  BaseDialog(
    v-model='showDialog',
    title='Инвестирование в проект',
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
import { useCreateProjectInvest } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSetPlan } from '../../../Project/SetPlan/model';
import type { IProject } from '../../../../entities/Project/model';

const props = defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  actionCompleted: [];
}>();

const {
  createProjectInvestWithGeneratedStatement,
  isGenerating
} = useCreateProjectInvest();
const { governSymbol } = useSetPlan();

const quantity = ref<number | string | null>(null);
const showDialog = ref(false);

const currency = computed(() => governSymbol.value);

const isValidAmount = computed(() => Number(quantity.value) > 0);

// Ошибку показываем только после ввода, чтобы пустая форма не краснела
const amountError = computed(() =>
  quantity.value !== null && quantity.value !== '' && !isValidAmount.value
    ? 'Сумма инвестиций должна быть положительной'
    : undefined,
);

const clear = (): void => {
  showDialog.value = false;
  quantity.value = null;
};

// Обработка инвестирования (генерация + подпись + создание)
const handleInvest = async (): Promise<void> => {
  if (!props.project?.project_hash) {
    FailAlert('Не указан проект');
    return;
  }
  if (!isValidAmount.value) return;

  isGenerating.value = true;
  try {
    await createProjectInvestWithGeneratedStatement(
      String(quantity.value),
      props.project.project_hash
    );

    SuccessAlert('Инвестиция принята');
    clear();
    emit('actionCompleted');
  } catch (e: any) {
    console.log('e.message', e.message);
    FailAlert(e);
  } finally {
    isGenerating.value = false;
  }
};

defineExpose({
  openDialog: () => {
    showDialog.value = true;
  },
});
</script>
