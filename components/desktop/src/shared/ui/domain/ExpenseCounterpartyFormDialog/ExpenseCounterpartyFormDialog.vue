<template lang="pug">
//- Контрагент — организация или ИП для оплаты по реквизитам (задача 99D-35).
//- Одна форма на реестр контрагентов стола совета и на кнопку «Добавить» в
//- поле выбора получателя. Поля реквизитов и их правила приходят с сервера —
//- они страновые (пакет юрисдикций); сервер проверяет ими же, здесь — только
//- подсказка до отправки. ИНН идёт первым: если для страны есть поставщик
//- сведений, полный ИНН сам заполняет поля организации из государственного
//- реестра, и подставленные поля закрываются для правки (общий
//- useRegistryLookup). ИНН правится всегда: изменили или стёрли ИНН —
//- подставленное снимается, новый полный ИНН снова идёт в реестр.
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
      :model-value='kind',
      :options='kindOptions',
      :aria-label='$t("ui.expenseCounterparty.kindLabel")',
      @update:model-value='onKind'
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
        template(v-if='lookingUp' #append)
          q-spinner(size='18px', color='primary')
      BaseInput(
        v-model='name',
        :disabled='isLocked("name")',
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
          :disabled='isLockedKey(field.key)',
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
import { useFormDraft } from 'src/shared/lib/composables';
import { BaseButton, BaseDialog, BaseInput, BaseSegmented } from 'src/shared/ui/base';
import { lookupEntrepreneur, lookupOrganization, useRegistryLookup } from 'src/shared/ui/UserDataForm/useRegistryLookup';
import {
  checkExpenseCounterpartyRequisites,
  createExpenseCounterparty,
  getExpenseCounterpartyForm,
  updateExpenseCounterparty,
  type ExpenseCounterpartyFormView,
  type ExpenseCounterpartyView,
} from 'src/shared/lib/expenses/counterparties';

type FormField = ExpenseCounterpartyFormView['kinds'][number]['fields'][number];

const props = defineProps<{
  modelValue: boolean;
  /**
   * Окно правки получает это свойство всегда — контрагента или null, пока
   * никто не выбран. Окно создания его не получает и держит черновик.
   */
  counterparty?: ExpenseCounterpartyView | null;
  /** Участок, который добавляет контрагента; пусто — контрагент кооператива. */
  braname?: string | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [counterparty: ExpenseCounterpartyView];
}>();

// Форма одна на весь стол — грузится один раз.
let formCache: Promise<ExpenseCounterpartyFormView> | null = null;

const form = ref<ExpenseCounterpartyFormView | null>(null);
const kind = ref<Zeus.ExpenseCounterpartyKind>(Zeus.ExpenseCounterpartyKind.LEGAL);
const name = ref('');
const paymentPurpose = ref('');
const values = reactive<Record<string, string>>({});
const touched = ref(false);
const saving = ref(false);
/** Нарушения по полям от сервера: вид значения и контрольные суммы. */
const serverIssues = ref<Record<string, string>>({});

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

/** Сведения из государственного реестра: наименование и реквизиты организации. */
interface RegistryFound {
  name?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
}

/** Юрлицо или ИП — по виду контрагента; ответ приводится к полям формы. */
async function findInRegistry(query: { country: string; inn: string }): Promise<RegistryFound | null> {
  if (kind.value === Zeus.ExpenseCounterpartyKind.LEGAL) {
    const org = await lookupOrganization(query);
    return org ? { name: org.short_name || org.full_name, kpp: org.details.kpp, ogrn: org.details.ogrn } : null;
  }
  const ip = await lookupEntrepreneur(query);
  if (!ip) return null;
  const fio = [ip.last_name, ip.first_name, ip.middle_name].filter(Boolean).join(' ');
  return { name: fio ? t('ui.expenseCounterparty.entrepreneurName', { name: fio }) : undefined, ogrn: ip.details.ogrn };
}

/** Поле формы, которое заполняет реестр: наименование или ключ реквизита. */
type LookupField = 'name' | 'kpp' | 'ogrn';

const {
  loading: lookingUp,
  lookupState,
  isLocked,
  resetLookup,
  lookupCurrent,
} = useRegistryLookup<RegistryFound, LookupField>({
  country: () => form.value?.country,
  inn: () => (taxField.value ? values[taxField.value.key] : undefined),
  find: findInRegistry,
  apply: (found) => {
    const filled: LookupField[] = [];
    if (found.name) {
      name.value = found.name;
      filled.push('name');
    }
    for (const key of ['kpp', 'ogrn'] as const) {
      const value = found[key];
      if (value && fields.value.some((f) => f.key === key)) {
        values[key] = value;
        filled.push(key);
      }
    }
    return filled;
  },
  // Новый ИНН: сведения прежнего поиска снимаются, ИНН остаётся как введён.
  clear: (filled) => {
    for (const field of filled) {
      if (field === 'name') name.value = '';
      else delete values[field];
    }
  },
  onDetailsShown: () => undefined,
});

// ИНН правится всегда. Изменили или стёрли ИНН — подставленное прежним поиском
// снимается, полный новый ИНН снова идёт в реестр.
watch(
  () => (taxField.value ? values[taxField.value.key] : undefined),
  (inn, before) => {
    if (lookupState.value !== 'found' || inn === before) return;
    resetLookup();
    lookupCurrent();
  },
);

/** Реквизит закрыт для правки: его подставил реестр. */
function isLockedKey(key: string): boolean {
  return (key === 'kpp' || key === 'ogrn') && isLocked(key);
}

const lookupHint = computed(() => {
  if (lookupState.value === 'found') return t('ui.expenseCounterparty.lookupFound');
  if (lookupState.value === 'notFound') return t('ui.expenseCounterparty.lookupNotFound');
  return undefined;
});

/** Окно создания: свойства counterparty нет совсем (см. описание свойства). */
const isCreate = props.counterparty === undefined;

// Черновик нового контрагента переживает случайное закрытие окна (клик мимо,
// Esc) и перезагрузку страницы; стирается только после сохранения. Ключ — по
// участку: черновик реестра совета и черновик участка не смешиваются.
// Реквизиты — словарь с ключами по стране, поэтому в черновик идут парами.
const requisitesDraft = computed<[string, string][]>({
  get: () => Object.entries(values),
  set: (entries) => {
    for (const key of Object.keys(values)) delete values[key];
    for (const [key, value] of entries ?? []) values[key] = value;
  },
});
const { clearDraft } = isCreate
  ? useFormDraft(
      `expenses_form_draft_counterparty:${props.braname ?? 'coop'}`,
      { kind, name, paymentPurpose, requisites: requisitesDraft },
      { restoreOnMount: true },
    )
  : { clearDraft: () => undefined };

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    if (isCreate) {
      // Закрытие без сохранения введённое не трогает — снимаются только ошибки.
      touched.value = false;
    } else {
      resetLookup();
      fill(props.counterparty ?? null);
    }
    try {
      formCache ??= getExpenseCounterpartyForm();
      form.value = await formCache;
      // ИНН уже стоит (правка или черновик) — сведения из реестра подставляются и закрываются сразу.
      lookupCurrent();
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
  serverIssues.value = {};
}

/** Смена вида: ИНН юрлица и ИП разной длины, поэтому ИНН и подставленное снимаются. */
function onKind(next: Zeus.ExpenseCounterpartyKind): void {
  if (next === kind.value) return;
  resetLookup();
  if (taxField.value) delete values[taxField.value.key];
  kind.value = next;
}

/** Маска поля — из правил страны; поле из цифр — ровно его длина; иначе ввод свободный. */
function maskOf(field: FormField): string | undefined {
  if (field.mask) return field.mask;
  return field.length ? '#'.repeat(field.length) : undefined;
}

function filledRequisites() {
  return fields.value.map((f) => ({ key: f.key, value: values[f.key]?.trim() ?? '' })).filter((r) => r.value);
}

/** Реквизиты проверяет сервер теми же правилами, что при сохранении; ответ — нарушения по полям. */
async function runCheck(): Promise<Record<string, string>> {
  if (!form.value) return {};
  try {
    const issues = await checkExpenseCounterpartyRequisites({ kind: kind.value, requisites: filledRequisites() });
    serverIssues.value = Object.fromEntries(issues.map((i) => [i.key, i.code]));
  } catch {
    serverIssues.value = {};
  }
  return serverIssues.value;
}

let checkTimer: ReturnType<typeof setTimeout> | null = null;
watch([kind, values], () => {
  if (checkTimer) clearTimeout(checkTimer);
  // timing: debounce — проверка реквизитов после паузы ввода, а не на каждую цифру.
  checkTimer = setTimeout(() => void runCheck(), 400);
}, { deep: true });

/** Подсказка до отправки: пусто, не та длина, не тот вид. Контрольные суммы проверяет сервер. */
function errorOf(field: FormField): string | undefined {
  const value = values[field.key]?.trim() ?? '';
  if (!value) return touched.value && field.required ? t('ui.expenseCounterparty.fieldRequired') : undefined;
  if (field.length && value.length !== field.length) {
    return touched.value ? t('ui.expenseCounterparty.fieldLength', { n: String(field.length) }) : undefined;
  }
  if (field.pattern && !new RegExp(field.pattern).test(value)) return t('ui.expenseCounterparty.fieldFormat');
  return serverIssueText(field);
}

/**
 * Нарушение от сервера по заполненному полю: неверный вид или номер не
 * сходится. Номер, который сверяется с другим полем (счёт — с БИК), называет
 * это поле: ошибка может быть в любом из двух.
 */
function serverIssueText(field: FormField): string | undefined {
  const code = serverIssues.value[field.key];
  if (code === 'CHECKSUM') {
    const pair = field.checked_with ? fields.value.find((f) => f.key === field.checked_with) : undefined;
    return pair
      ? t('ui.expenseCounterparty.fieldChecksumWith', { field: pair.label })
      : t('ui.expenseCounterparty.fieldChecksum');
  }
  if (code === 'FORMAT') return t('ui.expenseCounterparty.fieldFormat');
  return undefined;
}

async function onSave(): Promise<void> {
  touched.value = true;
  await runCheck();
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
    if (isCreate) {
      // Следующее создание начинается с пустой формы.
      clearDraft();
      resetLookup();
      fill(null);
    }
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
