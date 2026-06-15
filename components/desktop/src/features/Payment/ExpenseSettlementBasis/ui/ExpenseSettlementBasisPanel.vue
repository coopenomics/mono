<template lang="pug">
.settlement-basis
  .exp-step
    .exp-step__num
      q-icon(name='link', size='14px')
    .exp-step__title Основание расчёта
  .t-sm.t-muted Расчёт по авансу под отчёт{{ proposalLabel }}. {{ basisHint }}

  button.settlement-basis__link(type='button', @click='emit("open-source", itemHash)')
    q-icon(name='open_in_new', size='15px')
    span Открыть платёж выдачи аванса

  .settlement-basis__rows
    DataRow(label='Что оплачивали', :value='descriptionLabel')
    DataRow(label='Выдано авансом', :value='advanceLabel', mono)
    DataRow(label='Заявлено по чекам', :value='reportedLabel', mono)
    DataRow(:label='settlementRowLabel', :value='settlementLabel', mono)

  .settlement-basis__docs
    .t-sm.t-muted(v-if='loadingFiles') Загрузка подтверждающих документов…
    template(v-else-if='files.length')
      .t-sm.t-muted Подтверждающие документы пайщика:
      .files
        button.file-link(
          v-for='file in files',
          :key='file.id',
          type='button',
          :disabled='openingId === file.id',
          @click='openFile(file)'
        )
          q-icon(name='attach_file', size='16px')
          span {{ fileLabel(file) }}
          q-spinner(v-if='openingId === file.id', size='14px')
    .t-sm.t-warning(v-else) Подтверждающие документы пайщик ещё не приложил.
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { DataRow } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { shortExpenseId } from 'src/shared/lib/expenses';
import {
  reportExpenseAdvanceApi,
  type IExpenseProposalItem,
} from 'src/features/Payment/ReportExpenseAdvance';
import {
  attachExpenseProofApi,
  type IExpenseFile,
} from 'src/features/Payment/AttachExpenseProof';

const props = defineProps<{
  // Хэши исходной СЗ и строки-аванса (item_hash == хэш платежа выдачи аванса).
  proposalHash: string;
  itemHash: string;
  // Сумма этой расчётной платёжки и её направление — чтобы показать кассиру
  // «выдано → заявлено → разница» без поиска исходной строки в реестре.
  settlementAmount: string;
  isReturn: boolean;
  // Описание расхода из самой платёжки (fallback — из позиции СЗ).
  description?: string;
}>();

const emit = defineEmits<{
  // Кассир жмёт «Основание» → реестр раскрывает платёж выдачи аванса (по item_hash).
  (e: 'open-source', itemHash: string): void;
}>();

const system = useSystemStore();

const item = ref<IExpenseProposalItem | null>(null);
const files = ref<IExpenseFile[]>([]);
const loadingFiles = ref(true);

const proposalLabel = computed(() =>
  props.proposalHash ? ` по СЗ № ${shortExpenseId(props.proposalHash)}` : '',
);
const basisHint = computed(() =>
  props.isReturn
    ? 'Пайщик отчитался на меньшую сумму — возвращает разницу кооперативу.'
    : 'Пайщик отчитался на большую сумму — кооператив доплачивает разницу.',
);
const descriptionLabel = computed(
  () => props.description || item.value?.description || '—',
);
// Выданный аванс — фактически выданная по payexp сумма (actual_amount).
const advanceLabel = computed(() =>
  item.value?.actual_amount ? formatAsset2Digits(item.value.actual_amount) : '—',
);
// Заявленный факт = аванс ± сумма расчёта (возврат уменьшает, доплата увеличивает).
const reportedLabel = computed(() => {
  if (!item.value?.actual_amount) return '—';
  const advance = parseAsset(item.value.actual_amount);
  const settlement = parseAsset(props.settlementAmount);
  if (!advance.symbol) return '—';
  const reported = props.isReturn
    ? advance.num - settlement.num
    : advance.num + settlement.num;
  return formatAsset2Digits(
    `${reported.toFixed(advance.precision)} ${advance.symbol}`,
  );
});
const settlementRowLabel = computed(() =>
  props.isReturn ? 'К возврату кооперативу' : 'К доплате пайщику',
);
const settlementLabel = computed(() =>
  props.settlementAmount ? formatAsset2Digits(props.settlementAmount) : '—',
);

// "1000.0000 RUB" → { num, symbol, precision }.
function parseAsset(asset?: string | null): { num: number; symbol: string; precision: number } {
  if (!asset) return { num: 0, symbol: '', precision: 0 };
  const [amountStr, symbol = ''] = asset.split(' ');
  const dot = amountStr.indexOf('.');
  const precision = dot >= 0 ? amountStr.length - dot - 1 : 0;
  return { num: Number.parseFloat(amountStr) || 0, symbol, precision };
}

function fileLabel(file: IExpenseFile): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at
    ? new Date(String(file.uploaded_at)).toLocaleString('ru-RU')
    : '';
  return `Чек от ${date}`;
}

const openingId = ref<number | null>(null);
async function openFile(file: IExpenseFile): Promise<void> {
  try {
    openingId.value = file.id;
    const url = await attachExpenseProofApi.getExpenseFileReadUrl(file.id);
    if (!url) throw new Error('Не удалось получить ссылку на файл');
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    FailAlert(e);
  } finally {
    openingId.value = null;
  }
}

async function load(): Promise<void> {
  try {
    const proposal = await reportExpenseAdvanceApi.loadExpenseProposal(props.proposalHash);
    item.value =
      proposal?.items?.find(
        (i) => i.item_hash?.toLowerCase() === props.itemHash.toLowerCase(),
      ) ?? null;
    const all = await attachExpenseProofApi.loadExpenseFilesByItem(
      system.info.coopname,
      props.proposalHash,
      props.itemHash,
    );
    files.value = all.filter((f) => f.kind === Zeus.ExpenseFileKind.REPORT_FILE);
  } catch {
    // Блок основания — вспомогательный: ошибки его загрузки не ломают реестр.
    item.value = null;
  } finally {
    loadingFiles.value = false;
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.settlement-basis {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.exp-step {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.exp-step__num {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: var(--p-r-pill);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.exp-step__title {
  font-weight: 600;
  color: var(--p-ink);
}

.settlement-basis__link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.settlement-basis__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.settlement-basis__docs {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.files {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm);
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
