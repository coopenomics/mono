<template lang="pug">
.report-advance(v-if='item')
  template(v-if='isReported || isAwaitingReport')
    .exp-step(v-if='step')
      .exp-step__num {{ step.number }}
      .exp-step__title {{ step.title }}
    //- Отчёт уже подан — форма недоступна (повторный отчёт запрещён и на бэке),
    //- остаётся только загрузка дополнительных документов.
    template(v-if='reportSubmitted')
      .t-sm.t-muted(v-if='pendingSettlement') Отчёт подан{{ reportedAmountLabel }} — ждём подтверждения расчёта кассой, после него позиция закроется. Дополнительные документы можно приложить ниже.
      .t-sm.t-muted(v-else) Отчёт по авансу принят — дополнительные документы дополнят его автоматически.
    template(v-else)
      .t-sm.report-advance__lead(v-if='onBehalf')
        q-icon(name='assignment_ind', size='16px')
        span Чеки получены от пайщика лично. Укажите фактически потраченную сумму и приложите чек — отчёт уйдёт от его имени.
      .t-sm.t-muted(v-else) Выданный аванс: {{ advanceLabel }}. Укажите фактически потраченную сумму и приложите чек.

    //- Сначала сумма (с ней видна разница), затем чек — и только тогда кнопка.
    template(v-if='canReport')
      .report-advance__amount
        AmountInput(
          v-model='factualAmount',
          :symbol='advanceSymbol',
          :precision='2',
          :min='0',
          label='Фактически потрачено по чекам',
          :disabled='reporting'
        )
      .t-sm.t-warning(v-if='deltaHint') {{ deltaHint }}

    //- Загрузчик доступен и после приёма отчёта — доп. документы дополняют его.
    FileUploader(
      v-model='pending',
      accept='image/jpeg,image/png,image/webp,image/heic,application/pdf',
      :max-size='20 * 1024 * 1024',
      :title='canReport ? "Приложите чек" : "Приложите дополнительный документ"',
      hint='Изображение или PDF до 20 МБ — добавится сразу',
      :disabled='uploading || reporting'
    )

    .files(v-if='files.length')
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

    BaseButton(
      v-if='canReport',
      variant='primary',
      :loading='reporting',
      :disabled='!files.length || reporting',
      @click='submitReport'
    ) {{ onBehalf ? 'Отчитаться за пайщика' : 'Отчитаться по авансу' }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { FileUploader } from 'src/shared/ui/domain/FileUploader';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { BaseButton } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { ExpenseReportState } from 'src/shared/lib/expenses';
import {
  attachExpenseProofApi,
  type IExpenseFile,
} from 'src/features/Payment/AttachExpenseProof';
import { api, type IExpenseProposalItem } from '../api';

const props = withDefaults(
  defineProps<{
    proposalHash: string;
    itemHash: string;
    // Кассир отчитывается за пайщика (чеки переданы лично) — меняет только подписи,
    // мутация та же (бэкенд авторизует совет по любой строке).
    onBehalf?: boolean;
    // Опциональный заголовок-этап (номер + название) — показывается только когда
    // у панели есть контент, поэтому пустых «Этапов» у строк без отчёта не будет.
    step?: { number: number | string; title: string };
    // Зеркало blockchain_data.report_state платежа выдачи аванса. Позиция on-chain
    // остаётся PAID до подтверждения расчёта кассой, поэтому факт «отчёт уже подан»
    // берём отсюда, а не из item.status — иначе форма остаётся активной и пускает
    // повторный отчёт.
    reportState?: string;
    // Заявленная пайщиком сумма по чекам (при поданном отчёте) — для показа вместо
    // выданного аванса.
    reportedAmount?: string;
  }>(),
  { onBehalf: false, step: undefined, reportState: '', reportedAmount: '' },
);

const emit = defineEmits<{
  // settlementHash — хэш заведённого расчётного платежа (возврат/доплата), чтобы
  // реестр сразу раскрыл его с реквизитами; пусто при простом закрытии (факт==аванс).
  (e: 'reported', settlementHash?: string): void;
}>();

const system = useSystemStore();

const item = ref<IExpenseProposalItem | null>(null);
const files = ref<IExpenseFile[]>([]);
const pending = ref<File | null>(null);
const uploading = ref(false);
const reporting = ref(false);
// Фактически потраченная сумма по чекам; null до инициализации выданным авансом.
const factualAmount = ref<number | null>(null);

// Выданный аванс — это item.actual_amount (проставлен payexp при выдаче), не план:
// расчёт разницы ведём от реально полученной пайщиком суммы.
const advance = computed(() => parseAsset(item.value?.actual_amount));
const advanceSymbol = computed(() => advance.value.symbol);
const advanceLabel = computed(() =>
  item.value?.actual_amount ? formatAsset2Digits(item.value.actual_amount) : '',
);

// Подсказка о недо-/перерасходе до отправки отчёта.
const deltaHint = computed(() => {
  if (factualAmount.value == null || !item.value) return '';
  const advanceMinor = Math.round(advance.value.num * 10 ** advance.value.precision);
  const factualMinor = Math.round(factualAmount.value * 10 ** advance.value.precision);
  const diffMinor = factualMinor - advanceMinor;
  if (diffMinor === 0) return '';
  const diff = Math.abs(diffMinor) / 10 ** advance.value.precision;
  const diffLabel = formatAsset2Digits(
    `${diff.toFixed(advance.value.precision)} ${advance.value.symbol}`,
  );
  return diffMinor < 0
    ? `Недорасход ${diffLabel}: будет создан платёж возврата — его нужно оплатить кооперативу.`
    : `Перерасход ${diffLabel}: будет создан платёж доплаты — кооператив выплатит разницу.`;
});

// Панель — только для аванса под отчёт: по счёту (DIRECT) отчётный документ
// прикладывает кассир, пайщику отчитываться нечем.
async function refresh(): Promise<void> {
  try {
    const proposal = await api.loadExpenseProposal(props.proposalHash);
    const found = proposal?.items?.find(
      (i) => i.item_hash?.toLowerCase() === props.itemHash.toLowerCase(),
    );
    item.value =
      found && found.mechanics === Zeus.ExpenseMechanics.ADVANCE ? found : null;
    if (!item.value) return;

    // Префилл фактической суммы выданным авансом — типовой случай «потратил ровно».
    if (factualAmount.value == null) {
      factualAmount.value = parseAsset(item.value.actual_amount).num;
    }

    const all = await attachExpenseProofApi.loadExpenseFilesByItem(
      system.info.coopname,
      props.proposalHash,
      props.itemHash,
    );
    files.value = all.filter((f) => f.kind === Zeus.ExpenseFileKind.REPORT_FILE);
  } catch {
    // Панель отчёта — вспомогательная: ошибки её загрузки не прерывают реестр.
    item.value = null;
  }
}

const isReported = computed(
  () => item.value?.status === Zeus.ExpenseItemStatus.REPORTED,
);
const isAwaitingReport = computed(
  () => item.value?.status === Zeus.ExpenseItemStatus.PAID,
);

// Отчёт подан, но позиция ещё не закрыта on-chain — ждём подтверждения расчёта.
const pendingSettlement = computed(
  () => props.reportState === ExpenseReportState.SETTLEMENT_PENDING,
);
const closedByState = computed(
  () => props.reportState === ExpenseReportState.CLOSED,
);
// Форма отчёта доступна, только пока отчёт не подан: позиция PAID и report_state
// ещё не SETTLEMENT_PENDING/CLOSED. Иначе — повторный отчёт (запрещён и на бэке).
const canReport = computed(
  () => isAwaitingReport.value && !pendingSettlement.value && !closedByState.value,
);
const reportSubmitted = computed(
  () => isReported.value || pendingSettlement.value || closedByState.value,
);
const reportedAmountLabel = computed(() =>
  props.reportedAmount ? ` на ${formatAsset2Digits(props.reportedAmount)}` : '',
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

// Списочные запросы файлов отдают записи без read_url (он короткоживущий) —
// свежая ссылка запрашивается по id в момент клика.
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

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function upload(): Promise<boolean> {
  const file = pending.value;
  if (!file) return false;
  try {
    uploading.value = true;
    const buffer = await file.arrayBuffer();
    await attachExpenseProofApi.uploadExpenseFile({
      coopname: system.info.coopname,
      proposal_hash: props.proposalHash,
      item_hash: props.itemHash,
      kind: Zeus.ExpenseFileKind.REPORT_FILE,
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: await sha256Hex(buffer),
      content_base64: toBase64(buffer),
      original_filename: file.name,
    });
    pending.value = null;
    return true;
  } catch (e) {
    FailAlert(e);
    return false;
  } finally {
    uploading.value = false;
  }
}

async function submitReport(): Promise<void> {
  if (factualAmount.value == null) return;
  try {
    reporting.value = true;
    // Фактическую сумму отправляем в формате asset, по precision выданного аванса.
    const actualAmount = `${factualAmount.value.toFixed(advance.value.precision)} ${advance.value.symbol}`;
    const result = await api.reportExpenseItem({
      coopname: system.info.coopname,
      proposal_hash: props.proposalHash,
      item_hash: props.itemHash,
      actual_amount: actualAmount,
    });

    const settlementLabel = result?.settlement_amount
      ? formatAsset2Digits(result.settlement_amount)
      : '';
    if (result?.outcome === Zeus.ExpenseReportOutcome.RETURN_PENDING) {
      SuccessAlert(
        `Заведён платёж возврата на ${settlementLabel}. Оплатите его кооперативу — после подтверждения кассой отчёт закроется.`,
      );
    } else if (result?.outcome === Zeus.ExpenseReportOutcome.OVERSPEND_PENDING) {
      SuccessAlert(
        `Заведён платёж доплаты на ${settlementLabel}. Кооператив выплатит разницу — после подтверждения кассой отчёт закроется.`,
      );
    } else {
      SuccessAlert('Отчёт по авансу принят');
    }
    await refresh();
    emit('reported', result?.settlement_payment_hash ?? undefined);
  } catch (e) {
    FailAlert(e);
  } finally {
    reporting.value = false;
  }
}

// Выбор файла = загрузка: чек прикладывается сразу. Отчёт (с фактической суммой)
// пайщик подаёт отдельной кнопкой — иначе не указать недо-/перерасход.
watch(pending, async (file) => {
  if (!file || uploading.value) return;
  const uploaded = await upload();
  if (!uploaded) return;
  SuccessAlert('Документ приложен');
  await refresh();
});

onMounted(refresh);
</script>

<style lang="scss" scoped>
.report-advance {
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
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.exp-step__title {
  font-weight: 600;
  color: var(--p-ink);
}

.report-advance__lead {
  display: flex;
  align-items: flex-start;
  gap: var(--p-1);
  color: var(--p-ink-2);
}

//- Сумма по чекам — короткое поле (значение выровнено вправо, в узком поле без
//- разрыва «лейбл … значение»), а не во всю ширину панели.
.report-advance__amount {
  max-width: 240px;
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
  text-decoration: none;
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
