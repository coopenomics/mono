<template lang="pug">
//- Создание СЗ-расхода — переиспользуемый виджет шасси расходов.
//- Виджет владеет формой, черновиком, валидацией, генерацией и подписью
//- заявления; на чейн собранный СЗ подаёт расширение-потребитель через
//- проп `submit` (capital — мутацией программного расхода, КУ — своей).
BaseDialog(
  :model-value='modelValue',
  :title='title || "Создание расхода"',
  size='lg',
  @update:model-value='$emit("update:modelValue", $event)'
)
  .create-form
    section.create-form__section
      h3.create-form__section-label.t-eyebrow Цель и параметры
      .create-form__fields
        BaseInput(
          v-model='form.description',
          label='Цель расходов',
          placeholder='Например: «Закупка хостинга и канцелярии на июнь»',
          required
        )
        BaseInput(
          v-model='form.deadline',
          type='date',
          label='Срок исполнения (в срок до)',
          required
        )

    section.create-form__section
      .create-form__section-head
        h3.create-form__section-label.t-eyebrow Строки расходов
        BaseButton(variant='ghost', size='sm', @click='addItem')
          template(#icon-left)
            q-icon(name='add', size='18px')
          | Добавить позицию

      EmptyState(
        v-if='!form.items.length',
        title='Нет позиций',
        body='Добавьте хотя бы одну строку расхода: получатель, способ оплаты и сумма.'
      )
        template(#icon)
          q-icon(name='playlist_add', size='40px')

      .create-form__items(v-else)
        .create-form__item(v-for='(item, idx) in form.items', :key='idx')
          .create-form__item-head
            span.create-form__item-title Позиция №{{ idx + 1 }}
            BaseButton(
              variant='ghost',
              size='sm',
              icon-only,
              aria-label='Удалить позицию',
              @click='removeItem(idx)'
            )
              template(#icon-left)
                q-icon(name='delete_outline', size='18px')

          .create-form__item-grid
            BaseSelect(
              v-model='item.recipient_type',
              :options='recipientTypeOptions',
              label='Тип получателя',
              @update:model-value='onRecipientTypeChange(item)'
            )
            BaseSelect(
              v-model='item.mechanics',
              :options='mechanicsOptions',
              label='Способ оплаты',
              disabled
            )

            .create-form__span(
              v-if='item.recipient_type === Zeus.ExpenseRecipientType.MEMBER'
            )
              UserSearchSelector(
                v-model='item.recipient_account',
                label='Пайщик-получатель (по ФИО)',
                :types='["individual"]',
                @update:model-value='item.payment_method_id = null'
              )

            BaseInput(
              v-if='item.recipient_type === Zeus.ExpenseRecipientType.ORG',
              v-model='item.recipient_name',
              label='Название организации',
              placeholder='Например: ООО «Хостинг-центр»',
              required
            )

            AmountInput(
              :model-value='amountAsNumber(item.amount)',
              label='Сумма (план)',
              :symbol='symbol',
              :precision='precision',
              placeholder='1000',
              @update:model-value='(v) => onAmountChange(item, v)'
            )

            .create-form__span
              BaseInput(
                v-model='item.description',
                label='Что оплачиваем',
                placeholder='Своими словами: что это за расход и зачем',
                required
              )

            .create-form__span(v-if='item.recipient_type === Zeus.ExpenseRecipientType.SELF')
              PaymentMethodSelect(
                v-model='item.payment_method_id',
                :username='session.username',
                hint='Реквизиты фиксируются на момент подачи — на них придёт выплата',
                required
              )
            .create-form__span(v-if='item.recipient_type === Zeus.ExpenseRecipientType.MEMBER')
              PaymentMethodSelect(
                v-model='item.payment_method_id',
                :username='item.recipient_account?.trim() || ""',
                :hint='item.recipient_account?.trim() ? "Реквизиты фиксируются на момент подачи" : "Сначала укажите аккаунт пайщика-получателя"',
                :empty-message='item.recipient_account?.trim() ? "У выбранного пайщика нет сохранённых реквизитов." : "Сначала укажите аккаунт пайщика-получателя."',
                required
              )

            .create-form__span(v-if='item.recipient_type === Zeus.ExpenseRecipientType.ORG')
              BaseInput(
                v-model='item.requisites',
                label='Реквизиты получателя',
                placeholder='ИНН, р/с, БИК',
                required
              )
            .create-form__span(v-if='item.recipient_type === Zeus.ExpenseRecipientType.ORG')
              BaseInput(
                v-model='item.payment_purpose',
                label='Назначение платежа',
                placeholder='Например: «Оплата по счёту № 814 от 01.06.2026 за аренду серверов»',
                required
              )

    WalletCard(
      v-if='totalPlanned > 0',
      compact,
      program='blagorost',
      title='Итого по позициям',
      :balance='totalPlannedFormatted',
      :symbol='symbol',
      balance-label='план',
      icon='receipt_long'
    )

  template(#footer)
    BaseButton(variant='ghost', :disabled='submitting', @click='close') Отмена
    BaseButton(
      variant='primary',
      :loading='submitting',
      :disabled='!canSubmit',
      @click='submitForm'
    ) Подать на одобрение
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Mutations, Zeus } from '@coopenomics/sdk';
import type { Cooperative } from 'cooptypes';
import { client } from 'src/shared/api/client';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseSelect } from 'src/shared/ui/base/BaseSelect';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect';
import { UserSearchSelector } from 'src/shared/ui/UserSearchSelector';
import type {
  ExpenseCreateDialogProps,
  ExpenseCreateDraftItem,
} from './ExpenseCreateDialog.types';

const props = defineProps<ExpenseCreateDialogProps>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const system = useSystemStore();
const session = useSessionStore();

const symbol = computed(() => system.info?.symbols?.root_govern_symbol ?? 'RUB');
const precision = computed(() => system.info?.symbols?.root_govern_precision ?? 4);

const form = reactive({
  description: '',
  deadline: '',
  items: [] as ExpenseCreateDraftItem[],
});

const submitting = ref(false);

function amountAsNumber(raw: string): number | null {
  if (!raw?.trim()) return null;
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function onAmountChange(item: ExpenseCreateDraftItem, value: number | null): void {
  item.amount = value == null ? '' : String(value);
}

const totalPlanned = computed(() =>
  form.items.reduce((sum, it) => sum + (amountAsNumber(it.amount) ?? 0), 0),
);

const totalPlannedFormatted = computed(() => {
  const asset = formatToAsset(totalPlanned.value, symbol.value, precision.value);
  return formatAsset2Digits(asset).replace(/\s*[A-Z]{3,7}\s*$/, '').trim() || '0,00';
});

// Черновик формы переживает перезаход: каждое изменение зеркалится в
// localStorage (ключ задаёт потребитель), восстановление — на маунте
// (SSR-safe), очистка — только после успешной подачи.
function restoreDraft(): void {
  try {
    const raw = localStorage.getItem(props.draftKey);
    if (!raw) return;
    const draft = JSON.parse(raw) as Partial<typeof form>;
    form.description = draft.description ?? '';
    form.deadline = draft.deadline ?? '';
    form.items = Array.isArray(draft.items) ? draft.items : [];
  } catch {
    localStorage.removeItem(props.draftKey);
  }
}

function clearDraft(): void {
  localStorage.removeItem(props.draftKey);
}

/**
 * Подставляет данные записи-источника в пустую форму: расход, открытый из
 * планового, сразу приходит с назначением, суммой и сроком. Начатый вручную
 * черновик не трогаем — он важнее подсказки.
 */
function applyPrefill(): void {
  if (!props.prefill) return;
  if (form.description || form.items.length) return;

  form.description = props.prefill.description;
  form.deadline = props.prefill.deadline ?? '';
  addItem();
  const item = form.items[0];
  if (item) {
    item.description = props.prefill.description;
    item.amount = props.prefill.amount;
  }
}

// Форма живёт между открытиями (черновик), поэтому подсказку применяем на
// каждом открытии — она сработает только если форма пуста.
watch(
  () => props.modelValue,
  (opened) => {
    if (opened) applyPrefill();
  },
);

onMounted(() => {
  restoreDraft();
  applyPrefill();
  if (!form.items.length) addItem();
  watch(
    form,
    () => {
      localStorage.setItem(props.draftKey, JSON.stringify(form));
    },
    { deep: true },
  );
});

const mechanicsOptions = [
  { label: 'Аванс под отчёт', value: Zeus.ExpenseMechanics.ADVANCE },
  { label: 'Оплата по счету', value: Zeus.ExpenseMechanics.DIRECT },
];

const recipientTypeOptions = [
  { label: 'Я сам', value: Zeus.ExpenseRecipientType.SELF },
  { label: 'Пайщик', value: Zeus.ExpenseRecipientType.MEMBER },
  { label: 'Организация/ИП', value: Zeus.ExpenseRecipientType.ORG },
];

// Пайщик получает только аванс под отчёт (личные реквизиты, отчитается чеком);
// организация — только прямую оплату по выставленным реквизитам.
function mechanicsFor(recipientType: Zeus.ExpenseRecipientType): Zeus.ExpenseMechanics {
  return recipientType === Zeus.ExpenseRecipientType.ORG
    ? Zeus.ExpenseMechanics.DIRECT
    : Zeus.ExpenseMechanics.ADVANCE;
}

function onRecipientTypeChange(item: ExpenseCreateDraftItem): void {
  item.payment_method_id = null;
  item.mechanics = mechanicsFor(item.recipient_type);
}

const canSubmit = computed(
  () =>
    form.description.trim().length > 0 &&
    form.deadline.trim().length > 0 &&
    form.items.length > 0 &&
    form.items.every(
      (i) =>
        i.amount.trim() &&
        (amountAsNumber(i.amount) ?? 0) > 0 &&
        i.description.trim() &&
        (i.recipient_type !== Zeus.ExpenseRecipientType.MEMBER || i.recipient_account?.trim()) &&
        (i.recipient_type === Zeus.ExpenseRecipientType.ORG
          ? Boolean(i.recipient_name?.trim() && i.requisites?.trim() && i.payment_purpose?.trim())
          : Boolean(i.payment_method_id)),
    ),
);

function addItem(): void {
  form.items.push({
    number: String(form.items.length + 1),
    description: '',
    amount: '',
    mechanics: Zeus.ExpenseMechanics.ADVANCE,
    recipient_type: Zeus.ExpenseRecipientType.SELF,
    recipient_name: '',
    requisites: '',
    payment_purpose: '',
    recipient_account: '',
    payment_method_id: null,
  });
}

function removeItem(idx: number): void {
  form.items.splice(idx, 1);
}

function close(): void {
  emit('update:modelValue', false);
}

/**
 * On-chain получатель (eosio::name): SELF — сам создатель, MEMBER — аккаунт
 * пайщика, ORG — пустое имя (организация не имеет аккаунта в кооперативе,
 * её название и реквизиты фиксируются в документе-заявлении).
 */
function resolveRecipient(item: ExpenseCreateDraftItem, creator: string): string {
  if (item.recipient_type === Zeus.ExpenseRecipientType.MEMBER) {
    const account = item.recipient_account?.trim();
    if (!account) throw new Error('Для получателя-пайщика укажите его аккаунт');
    return account;
  }
  if (item.recipient_type === Zeus.ExpenseRecipientType.ORG) return '';
  return creator;
}

function generateItemHash(expenseHash: string, idx: number): string {
  return `${expenseHash.slice(0, 56)}${idx.toString(16).padStart(8, '0')}`;
}

/** `YYYY-MM-DD` (date-input) → `DD.MM.YYYY` (документ). */
/**
 * Срок исполнения обязателен: он попадает в текст служебной записки, и без
 * него совет рассматривал бы расход без указания, к какому сроку платить.
 * Пустое или неполное значение выводит документ в нечитаемый вид, поэтому
 * подача прерывается здесь, а не «доезжает» до документа.
 */
function formatDeadline(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    throw new Error('Укажите срок исполнения — дату, к которой расход должен быть оплачен');
  }
  return `${day}.${month}.${year}`;
}

type GenerateStatementInput =
  Mutations.Expense.GenerateExpenseProposalStatementDocument.IInput['data'];

async function submitForm(): Promise<void> {
  try {
    submitting.value = true;

    if (!form.deadline.trim()) {
      throw new Error('Укажите срок исполнения — дату, к которой расход должен быть оплачен');
    }

    const expense_hash = await generateUniqueHash();
    const assetSymbol = symbol.value;
    const assetPrecision = precision.value;
    const totalAmount = form.items.reduce((sum, it) => sum + parseFloat(it.amount || '0'), 0);
    const total_amount = formatToAsset(totalAmount, assetSymbol, assetPrecision);

    // Полные реквизиты в документ подставляет сервер по payment_method_id;
    // фронт знает только сокращённое представление.
    const itemsForDoc = form.items.map((it, idx) => ({
      number: String(idx + 1),
      description: it.description,
      amount: formatToAsset(it.amount, assetSymbol, assetPrecision),
      recipient_type: it.recipient_type,
      mechanics: it.mechanics,
      recipient_name: it.recipient_name ?? '',
      requisites: it.requisites ?? '',
      payment_purpose: it.payment_purpose || undefined,
      payment_method_id: it.payment_method_id ?? undefined,
      recipient_username:
        it.recipient_type === Zeus.ExpenseRecipientType.MEMBER
          ? it.recipient_account?.trim()
          : undefined,
    }));

    const generateInput: GenerateStatementInput = {
      coopname: system.info.coopname,
      username: session.username,
      proposal_hash: expense_hash,
      proposal: {
        description: form.description,
        total_amount,
        items_count: form.items.length,
        source_wallet: props.sourceWallet,
        deadline: formatDeadline(form.deadline),
      },
      items: itemsForDoc,
    };

    const { [Mutations.Expense.GenerateExpenseProposalStatementDocument.name]: generatedDoc } =
      await client.Mutation(
        Mutations.Expense.GenerateExpenseProposalStatementDocument.mutation,
        { variables: { data: generateInput, options: { lang: 'ru' } } },
      );

    const digital = new DigitalDocument(generatedDoc);
    const signed = await digital.sign<Cooperative.Registry.ExpenseProposalStatement.Meta>(
      session.username,
      1,
    );

    const itemsForChain = form.items.map((it, idx) => ({
      item_hash: it.item_hash ?? generateItemHash(expense_hash, idx),
      mechanics: it.mechanics,
      recipient_type: it.recipient_type,
      recipient: resolveRecipient(it, session.username),
      description: it.description,
      planned_amount: formatToAsset(it.amount, assetSymbol, assetPrecision),
      payment_method_id: it.payment_method_id ?? undefined,
      requisites: it.requisites || undefined,
      payment_purpose: it.payment_purpose || undefined,
    }));

    await props.submit({
      expense_hash,
      description: form.description,
      deadline: form.deadline,
      items: itemsForChain,
      statement: signed,
    });

    SuccessAlert('Расход подан — заявление подписано и передано в совет');
    clearDraft();
    form.description = '';
    form.deadline = '';
    form.items = [];
    addItem();
    emit('created');
    close();
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<style lang="scss" scoped>
.create-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  min-width: 0;
}

.create-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  min-width: 0;
}

.create-form__section-label {
  margin: 0;
  color: var(--p-ink-3);
}

.create-form__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
}

.create-form__fields {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-width: 0;
}

.create-form__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.create-form__item {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  min-width: 0;
}

.create-form__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
}

.create-form__item-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.create-form__item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
  min-width: 0;
}

.create-form__span {
  grid-column: 1 / -1;
  min-width: 0;
}

@media (max-width: 600px) {
  .create-form__section {
    padding: var(--p-3) var(--p-4);
  }

  .create-form__item-grid {
    grid-template-columns: 1fr;
  }
}
</style>
