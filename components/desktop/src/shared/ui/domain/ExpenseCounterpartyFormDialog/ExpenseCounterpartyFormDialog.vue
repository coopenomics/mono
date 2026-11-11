<template lang="pug">
//- Контрагент — организация или ИП для оплаты по реквизитам (задача 99D-35).
//- Одна форма на реестр контрагентов стола совета и на кнопку «Добавить» в
//- поле выбора получателя. Поля реквизитов и их правила приходят с сервера —
//- они страновые (пакет юрисдикций); сервер проверяет ими же, здесь — только
//- подсказка до отправки. ИНН идёт первым: по нему поля организации
//- заполняются из государственного реестра, если для страны есть поставщик.
BaseDialog(
  :model-value='modelValue',
  :title='counterparty ? $t("ui.expenseCounterparty.formTitleEdit") : $t("ui.expenseCounterparty.formTitleNew")',
  size='lg',
  @update:model-value='emit("update:modelValue", $event)'
)
  .cp-form(v-if='form')
    .cp-form__scope
      q-icon(name='storefront', size='16px')
      span {{ scopeLabel }}

    BaseSegmented(
      v-model='kind',
      :options='kindOptions',
      :aria-label='$t("ui.expenseCounterparty.kindLabel")'
    )

    section.cp-form__section
      h3.cp-form__label {{ $t('ui.expenseCounterparty.organizationSection') }}
      BaseInput(
        v-if='taxField',
        v-model='values[taxField.key]',
        :label='taxField.label',
        :mask='maskOf(taxField)',
        :error='errorOf(taxField)',
        :hint='lookupHint',
        stack-label,
        required
      )
        template(v-if='lookupAvailable' #append)
          BaseButton(
            variant='secondary',
            size='sm',
            :loading='lookingUp',
            :disabled='!taxComplete',
            @click='onLookup'
          ) {{ $t('ui.expenseCounterparty.lookupAction') }}
      BaseInput(
        v-model='name',
        :label='$t("ui.expenseCounterparty.nameLabel")',
        :placeholder='$t("ui.expenseCounterparty.namePlaceholder")',
        :error='touched && !name.trim() ? $t("ui.expenseCounterparty.fieldRequired") : undefined',
        stack-label,
        required
      )
      .cp-form__grid
        BaseInput(
          v-for='field in organizationFields',
          :key='field.key',
          v-model='values[field.key]',
          :label='field.label',
          :mask='maskOf(field)',
          :error='errorOf(field)',
          stack-label,
          :required='field.required'
        )

    section.cp-form__section
      h3.cp-form__label {{ $t('ui.expenseCounterparty.bankSection') }}
      .cp-form__grid
        BaseInput(
          v-for='field in bankFields',
          :key='field.key',
          v-model='values[field.key]',
          :class='{ "cp-form__wide": !field.length }',
          :label='field.label',
          :mask='maskOf(field)',
          :error='errorOf(field)',
          stack-label,
          :required='field.required'
        )

    BaseInput(
      v-model='paymentPurpose',
      type='textarea',
      :rows='2',
      autogrow,
      :label='$t("ui.expenseCounterparty.purposeLabel")',
      :placeholder='$t("ui.expenseCounterparty.purposePlaceholder")',
      :hint='$t("ui.expenseCounterparty.purposeHint")',
      stack-label
    )

  .cp-form__loading(v-else)
    q-skeleton(type='rect', height='40px')
    q-skeleton(type='rect', height='120px')
    q-skeleton(type='rect', height='120px')

  template(#footer)
    BaseButton(variant='ghost', :disabled='saving', @click='emit("update:modelValue", false)') {{ $t('common.action.cancel') }}
    BaseButton(variant='primary', :loading='saving', :disabled='!form', @click='onSave') {{ $t('ui.expenseCounterparty.saveAction') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseDialog, BaseInput, BaseSegmented } from 'src/shared/ui/base';
import { lookupEntrepreneur, lookupOrganization, loadLookupCountries } from 'src/shared/ui/UserDataForm/useRegistryLookup';
import {
  createExpenseCounterparty,
  getExpenseCounterpartyForm,
  updateExpenseCounterparty,
  type ExpenseCounterpartyFormView,
  type ExpenseCounterpartyView,
} from 'src/shared/lib/expenses/counterparties';

type FormField = ExpenseCounterpartyFormView['kinds'][number]['fields'][number];

const props = defineProps<{
  modelValue: boolean;
  /** Правка — контрагент; пусто — новый контрагент. */
  counterparty?: ExpenseCounterpartyView | null;
  /** Участок, который добавляет контрагента; пусто — контрагент кооператива. */
  braname?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [counterparty: ExpenseCounterpartyView];
}>();

// Форма и страны с поиском по ИНН одни на весь стол — грузятся один раз.
let formCache: Promise<ExpenseCounterpartyFormView> | null = null;
let countriesCache: Promise<string[]> | null = null;

const form = ref<ExpenseCounterpartyFormView | null>(null);
const lookupCountries = ref<string[]>([]);
const kind = ref<Zeus.ExpenseCounterpartyKind>(Zeus.ExpenseCounterpartyKind.LEGAL);
const name = ref('');
const paymentPurpose = ref('');
const values = reactive<Record<string, string>>({});
const touched = ref(false);
const saving = ref(false);
const lookingUp = ref(false);
const lookupState = ref<'idle' | 'found' | 'notFound'>('idle');

const kindOptions = [
  { value: Zeus.ExpenseCounterpartyKind.LEGAL, label: t('ui.expenseCounterparty.kindLegal') },
  { value: Zeus.ExpenseCounterpartyKind.ENTREPRENEUR, label: t('ui.expenseCounterparty.kindEntrepreneur') },
];

const fields = computed<FormField[]>(() => form.value?.kinds.find((k) => k.kind === kind.value)?.fields ?? []);
const taxField = computed(() => fields.value.find((f) => f.tax_id) ?? null);
const organizationFields = computed(() => fields.value.filter((f) => f.group === 'organization' && !f.tax_id));
const bankFields = computed(() => fields.value.filter((f) => f.group === 'bank'));

const scopeBraname = computed(() => props.counterparty?.braname ?? props.braname ?? null);
const scopeLabel = computed(() =>
  scopeBraname.value
    ? t('ui.expenseCounterparty.branchMark', { branch: scopeBraname.value })
    : t('ui.expenseCounterparty.coopMark'),
);

const lookupAvailable = computed(() => !!form.value && lookupCountries.value.includes(form.value.country));
const taxComplete = computed(() => {
  const field = taxField.value;
  const value = field ? values[field.key]?.trim() ?? '' : '';
  return !!field && (!field.length || value.length === field.length);
});
const lookupHint = computed(() => {
  if (lookupState.value === 'found') return t('ui.expenseCounterparty.lookupFound');
  if (lookupState.value === 'notFound') return t('ui.expenseCounterparty.lookupNotFound');
  return undefined;
});

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    fill(props.counterparty ?? null);
    try {
      formCache ??= getExpenseCounterpartyForm();
      countriesCache ??= loadLookupCountries();
      [form.value, lookupCountries.value] = await Promise.all([formCache, countriesCache]);
    } catch (e) {
      formCache = null;
      FailAlert(e);
    }
  },
  { immediate: true },
);

function fill(cp: ExpenseCounterpartyView | null): void {
  for (const key of Object.keys(values)) delete values[key];
  kind.value = cp?.kind ?? Zeus.ExpenseCounterpartyKind.LEGAL;
  name.value = cp?.name ?? '';
  paymentPurpose.value = cp?.payment_purpose ?? '';
  for (const r of cp?.requisites ?? []) values[r.key] = r.value;
  touched.value = false;
  lookupState.value = 'idle';
}

/** Маска поля из цифр — ровно его длина; иначе ввод свободный. */
function maskOf(field: FormField): string | undefined {
  return field.length ? '#'.repeat(field.length) : undefined;
}

/** Подсказка до отправки: пусто, не та длина, не тот вид. Контрольные суммы проверяет сервер. */
function errorOf(field: FormField): string | undefined {
  if (!touched.value) return undefined;
  const value = values[field.key]?.trim() ?? '';
  if (!value) return field.required ? t('ui.expenseCounterparty.fieldRequired') : undefined;
  if (field.length && value.length !== field.length) {
    return t('ui.expenseCounterparty.fieldLength', { n: String(field.length) });
  }
  if (field.pattern && !new RegExp(field.pattern).test(value)) return t('ui.expenseCounterparty.fieldFormat');
  return undefined;
}

async function onLookup(): Promise<void> {
  const field = taxField.value;
  if (!form.value || !field) return;
  lookingUp.value = true;
  try {
    const query = { country: form.value.country, inn: values[field.key].trim() };
    if (kind.value === Zeus.ExpenseCounterpartyKind.LEGAL) {
      const found = await lookupOrganization(query);
      if (found) {
        name.value = found.short_name || found.full_name || name.value;
        if (found.details.kpp) values.kpp = found.details.kpp;
        if (found.details.ogrn) values.ogrn = found.details.ogrn;
      }
      lookupState.value = found ? 'found' : 'notFound';
    } else {
      const found = await lookupEntrepreneur(query);
      if (found) {
        const fio = [found.last_name, found.first_name, found.middle_name].filter(Boolean).join(' ');
        if (fio) name.value = t('ui.expenseCounterparty.entrepreneurName', { name: fio });
        if (found.details.ogrn) values.ogrn = found.details.ogrn;
      }
      lookupState.value = found ? 'found' : 'notFound';
    }
  } finally {
    lookingUp.value = false;
  }
}

async function onSave(): Promise<void> {
  touched.value = true;
  if (!name.value.trim() || fields.value.some((f) => errorOf(f))) return;
  saving.value = true;
  try {
    const requisites = fields.value
      .map((f) => ({ key: f.key, value: values[f.key]?.trim() ?? '' }))
      .filter((r) => r.value);
    const data = {
      kind: kind.value,
      name: name.value.trim(),
      requisites,
      payment_purpose: paymentPurpose.value.trim() || undefined,
    };
    const saved = props.counterparty
      ? await updateExpenseCounterparty({ ...data, id: props.counterparty.id })
      : await createExpenseCounterparty({ ...data, braname: props.braname ?? undefined });
    SuccessAlert(t('ui.expenseCounterparty.savedMessage'));
    emit('saved', saved);
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, t('ui.expenseCounterparty.saveFailed'));
  } finally {
    saving.value = false;
  }
}
</script>

<style lang="scss" scoped>
.cp-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.cp-form__scope {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.cp-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.cp-form__label {
  margin: 0 0 var(--p-1);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
}

.cp-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--p-3);
}

.cp-form__wide {
  grid-column: 1 / -1;
}

.cp-form__loading {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

@media (max-width: 600px) {
  .cp-form__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
