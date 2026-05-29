<template lang="pug">
div
  q-btn(
    color='primary'
    flat
    class='q-mt-sm full-width'
    :loading='isGenerating'
    @click='showDialog = true'
    label='Инвестировать'
  )

  BaseDialog(
    v-model='showDialog',
    title='Инвестирование в программу',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-sm(
      :handler-submit='handleInvest',
      :is-submitting='isGenerating',
      :button-cancel-txt='"Отменить"',
      :button-submit-txt='"Инвестировать"',
      @cancel='clear'
    )
      q-input(
        v-model='quantity',
        standout='bg-teal text-white',
        placeholder='Введите сумму',
        type='number',
        :min='0',
        :rules='[(val) => val > 0 || "Сумма должна быть положительной"]'
      )
        template(#append)
          span.text-overline {{ currency }}
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Form } from 'src/shared/ui/Form';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { useCreateProgramInvest } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';

const { createProgramInvestWithGeneratedStatement, isGenerating } =
  useCreateProgramInvest();
const system = useSystemStore();

const quantity = ref<number | string>();
const showDialog = ref(false);

const currency = computed(
  () => system.info?.symbols?.root_govern_symbol ?? 'GOV',
);

const clear = (): void => {
  showDialog.value = false;
  quantity.value = '';
};

const handleInvest = async (): Promise<void> => {
  try {
    await createProgramInvestWithGeneratedStatement(quantity.value!.toString());
    SuccessAlert('Инвестиция принята');
    clear();
  } catch (e: unknown) {
    FailAlert(e);
  }
};
</script>
