<template lang="pug">
div
  //- Иконка обязательна: в шапке на узком экране канон скрывает текстовый label
  //- (.topbar__actions .base-btn__label), и кнопка без иконки осталась бы пустой
  BaseButton(
    variant='primary',
    :loading='isGenerating',
    :aria-label='$t("capital.createProgramInvestButton.ariaLabel")',
    @click='showDialog = true'
  )
    template(#icon-left)
      q-icon(name='savings', size='18px')
    | {{ $t('capital.createProgramInvestButton.label') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.createProgramInvestButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    BaseForm(:loading='isGenerating', @submit='handleInvest')
      AmountInput(
        v-model='quantity',
        :label='$t("capital.createProgramInvestButton.amountLabel")',
        placeholder='0,00',
        :symbol='currency',
        :precision='2',
        :min='0',
        :error='amountError'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='clear') {{ $t('capital.createProgramInvestButton.cancel') }}
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isGenerating',
          :disabled='!isValidAmount'
        ) {{ $t('capital.createProgramInvestButton.label') }}
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { BaseButton, BaseDialog, BaseForm } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { useCreateProgramInvest } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';
import { t } from '../../../../i18n';

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
    ? t('capital.createProgramInvestButton.amountPositiveError')
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
    SuccessAlert(t('capital.createProgramInvestButton.success'));
    clear();
  } catch (e: unknown) {
    FailAlert(e);
  }
};
</script>
