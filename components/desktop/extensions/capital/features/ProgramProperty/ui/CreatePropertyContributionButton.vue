<template lang="pug">
div
  //- Иконка обязательна: в шапке на узком экране канон скрывает текстовый label
  BaseButton(
    variant='secondary',
    :loading='isSubmitting',
    :aria-label='$t("capital.createPropertyContributionButton.label")',
    @click='open = true'
  )
    template(#icon-left)
      q-icon(name='inventory_2', size='18px')
    | {{ $t('capital.createPropertyContributionButton.label') }}

  BaseDialog(
    v-model='open',
    :title='$t("capital.createPropertyContributionButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && reset()'
  )
    BaseForm(:loading='isSubmitting', @submit='submit')
      p.t-sm.t-muted.q-mt-none {{ $t('capital.createPropertyContributionButton.intro') }}
      BaseInput(
        v-model='form.name',
        :label='$t("capital.createPropertyContributionButton.nameLabel")',
        :placeholder='$t("capital.createPropertyContributionButton.namePlaceholder")',
        required
      )
      BaseInput(
        v-model='form.description',
        type='textarea',
        autogrow,
        :rows='3',
        :label='$t("capital.createPropertyContributionButton.descriptionLabel")',
        :hint='$t("capital.createPropertyContributionButton.descriptionHint")',
        required
      )
      .property-form__row
        BaseInput(
          v-model='form.quantity',
          :label='$t("capital.createPropertyContributionButton.quantityLabel")',
          required
        )
        BaseInput(
          v-model='form.unit',
          :label='$t("capital.createPropertyContributionButton.unitLabel")',
          required
        )
      AmountInput(
        v-model='form.amount',
        :label='$t("capital.createPropertyContributionButton.amountLabel")',
        placeholder='0,00',
        :symbol='currency',
        :precision='2',
        :min='0',
        :error='amountError'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='reset') {{ $t('common.action.cancel') }}
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isSubmitting',
          :disabled='!isValid'
        ) {{ $t('capital.createPropertyContributionButton.submit') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';
import { useProgramProperty, type PropertyPositionForm } from '../model';
import { t } from '../../../i18n';

const emit = defineEmits<{ submitted: [] }>();

const system = useSystemStore();
const { submitStatement, isSubmitting } = useProgramProperty();

const open = ref(false);
const blank = (): PropertyPositionForm => ({ name: '', description: '', quantity: '1', unit: t('capital.createPropertyContributionButton.unitDefault'), amount: null });
const form = reactive<PropertyPositionForm>(blank());

const currency = computed(() => system.info?.symbols?.root_govern_symbol ?? 'GOV');

// Одно заявление — одна позиция имущества (решение владельца 30.10.2026):
// все поля обязательны, оценку называет пайщик.
const isValidAmount = computed(() => Number(form.amount) > 0);
const isValid = computed(
  () => !!form.name.trim() && !!form.description.trim() && !!form.quantity.trim() && !!form.unit.trim() && isValidAmount.value,
);

// Ошибку показываем только после ввода, чтобы пустой диалог не открывался красным
const amountError = computed(() =>
  form.amount != null && !isValidAmount.value ? t('capital.createPropertyContributionButton.amountPositiveError') : undefined,
);

function reset(): void {
  open.value = false;
  Object.assign(form, blank());
}

async function submit(): Promise<void> {
  if (!isValid.value) return;
  try {
    await submitStatement(form);
    SuccessAlert(t('capital.createPropertyContributionButton.success'));
    reset();
    emit('submitted');
  } catch (e: unknown) {
    FailAlert(e);
  }
}
</script>

<style scoped lang="scss">
.property-form__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--p-3);
}
</style>
