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
    size='md'
  )
    //- Два шага: поля позиции → заявление целиком до подписи. «Назад»
    //- возвращает к полям; после правки стол собирает заявление заново.
    template(v-if='statement')
      p.t-sm.t-muted.q-mt-none {{ $t('capital.createPropertyContributionButton.previewIntro') }}
      DocumentHtmlReader(:html='statement.html')

    BaseForm(v-else, :loading='isGenerating', @submit='toPreview')
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
        required
      )
      .property-form__row
        BaseInput(
          v-model='form.quantity',
          :label='$t("capital.createPropertyContributionButton.quantityLabel")',
          :placeholder='$t("capital.createPropertyContributionButton.quantityPlaceholder")',
          required
        )
        BaseInput(
          v-model='form.unit',
          :label='$t("capital.createPropertyContributionButton.unitLabel")',
          :placeholder='$t("capital.createPropertyContributionButton.unitPlaceholder")',
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
        //- «Отмена» закрывает окно и оставляет черновик: пайщик может открыть
        //- договор на подпись и затем продолжить заполненную форму.
        BaseButton(variant='ghost', @click='open = false') {{ $t('common.action.cancel') }}
        BaseButton(
          variant='primary',
          type='submit',
          :loading='isGenerating',
          :disabled='!isValid'
        ) {{ $t('capital.createPropertyContributionButton.continue') }}

    template(v-if='statement' #footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='statement = null') {{ $t('common.action.back') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='submit') {{ $t('capital.createPropertyContributionButton.sign') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { LocalStorage } from 'quasar';
import { BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useProgramProperty, type PropertyPositionForm } from '../model';
import { t } from '../../../i18n';

const emit = defineEmits<{ submitted: [] }>();

const system = useSystemStore();
const session = useSessionStore();
const { generateStatement, submitStatement, isSubmitting, isGenerating } = useProgramProperty();

/** Заявление на показ; пусто — пайщик на шаге полей. */
const statement = ref<IGeneratedDocumentOutput | null>(null);

const blank = (): PropertyPositionForm => ({ name: '', description: '', quantity: '', unit: '', amount: null });

// Черновик заявления хранится до подачи: окно закрыли, подписали договор,
// вернулись — форма заполнена. Ключ свой у каждого пайщика.
const draftKey = computed(() => `capital:property-statement-draft:${session.username}`);
const form = reactive<PropertyPositionForm>({ ...blank(), ...(LocalStorage.getItem<PropertyPositionForm>(draftKey.value) ?? {}) });
watch(form, (value) => LocalStorage.set(draftKey.value, { ...value }), { deep: true });

const open = ref(false);
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

// Правка черновика после показа заявления: показанный текст уже не тот.
watch(form, () => (statement.value = null), { deep: true });
// Повторное открытие окна начинается с полей.
watch(open, (value) => {
  if (value) statement.value = null;
});

async function toPreview(): Promise<void> {
  if (!isValid.value) return;
  try {
    statement.value = await generateStatement(form);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function submit(): Promise<void> {
  if (!statement.value) return;
  try {
    await submitStatement(statement.value);
    SuccessAlert(t('capital.createPropertyContributionButton.success'));
    Object.assign(form, blank());
    LocalStorage.remove(draftKey.value);
    statement.value = null;
    open.value = false;
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
