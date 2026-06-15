<template lang="pug">
.q-pa-md
  //- Canon back-link под шапкой, слева — возврат к реестру расходов (откуда
  //- проваливаются в деталь). Виден всегда, даже пока расход грузится.
  button.expense-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='18px')
    span К реестру расходов

  q-inner-loading(:showing='loading && !proposal', color='primary')

  .expense-detail(v-if='proposal')
    //- Статус расхода — вверху страницы, справа (канон detail-страниц).
    .head-row
      BaseChip(
        v-if='proposal.status',
        :variant='proposalStatusVariant(proposal.status)'
      ) {{ proposalStatusLabel(proposal.status) }}

    .section
      .t-eyebrow.t-muted Сводка
      BaseCard
        .summary
          DataRow(label='Пайщик', :value='creatorName')
          DataRow(label='Аккаунт', :value='proposal.username || "—"', mono, copyable)
          DataRow(label='Кооператив', :value='proposal.coopname || "—"')
          DataRow(label='Кошелёк (пул)', :value='walletLabel(proposal.source_wallet)')
          DataRow(label='Сумма (план)', :value='formatAmount(proposal.total_planned)')
          DataRow(label='Сумма (факт)', :value='formatAmount(proposal.total_actual)')
          DataRow(label='Создана', :value='formatDate(proposal.created_at)')
          DataRow(label='Обновлена', :value='formatDate(proposal.updated_at)')
          DataRow(label='Хеш', :value='proposal.proposal_hash', mono, copyable, align='vertical')

    //- Документы расхода — заявление (СЗ) и протокол решения совета. Клик по
    //- строке раскрывает сам документ во всплывашке (доменный канон шасси).
    .section
      .t-eyebrow.t-muted Документы
      BaseCard
        ExpenseProposalDocuments(
          v-if='hasDocuments',
          :statement='proposal.statement_doc',
          :decision='proposal.decision_doc'
        )
        EmptyState(
          v-else,
          title='Документы не сформированы',
          body='Здесь появятся служебная записка и протокол решения совета.'
        )
          template(#icon)
            q-icon(name='description', size='40px')

    .section
      .t-eyebrow.t-muted Строки расходов
      BaseCard
        .items-head(v-if='itemsCount')
          span.t-muted {{ itemsCountLabel }}
        .table-wrap(v-if='itemsCount')
          .table-scroll
            table.table
              thead
                tr
                  th Получатель
                  th Способ
                  th.col-num План
                  th.col-num Факт
                  th Статус
              tbody
                tr(v-for='item in proposal.items', :key='item.item_hash')
                  td.cell-name {{ item.recipient || '—' }}
                  td {{ mechanicsLabel(item.mechanics) }}
                  td.col-num {{ formatAmount(item.planned_amount) }}
                  td.col-num {{ formatAmount(item.actual_amount) }}
                  td
                    BaseBadge(:variant='itemStatusVariant(item.status)') {{ itemStatusLabel(item.status) }}
        EmptyState(
          v-else,
          title='Нет строк',
          body='У этой служебной записки нет позиций.'
        )
          template(#icon)
            q-icon(name='list', size='40px')

    //- Платежи по расходу — выдача аванса/оплата организации и, если был
    //- перерасчёт по чекам, расчётная платёжка (возврат недорасхода или
    //- доплата перерасхода). Реквизиты «куда уходил платёж», назначение и
    //- причина отклонения — внутри PaymentDetails. Клик ведёт на реестр
    //- платежей к этому конкретному платежу.
    .section(v-if='loadingPayments || linkedPayments.length')
      .t-eyebrow.t-muted Платежи по расходу
      BaseCard
        .t-sm.t-muted(v-if='loadingPayments && !linkedPayments.length') Загрузка платежей…
        .pay-list(v-else)
          .pay-item(v-for='(pay, idx) in linkedPayments', :key='pay.hash ?? idx')
            .pay-item__head
              .pay-item__title
                q-icon(:name='paymentDirectionIcon(pay)', size='16px')
                span {{ pay.type_label || pay.type }}
              .pay-item__amount
                BaseBadge(:variant='paymentStatusVariant(pay.status)') {{ pay.status_label || pay.status }}
                span.t-mono {{ formatAmount(paymentAmount(pay)) }}
            PaymentDetails(:payment='pay')
            button.pay-item__link(type='button', @click='openInRegistry(pay)')
              q-icon(name='open_in_new', size='15px')
              span Открыть в реестре платежей

    //- Чеки/подтверждения — кликабельное имя файла открывает документ в новой
    //- вкладке (как на странице расхода программы: read_url короткоживущий,
    //- запрашиваем свежий по id в момент клика).
    .section(v-if='files.length')
      .t-eyebrow.t-muted Чеки и подтверждения
      BaseCard
        .files
          .file-row(v-for='file in files', :key='file.id')
            button.file-link(
              type='button',
              :disabled='openingId === file.id',
              @click='openFile(file)'
            )
              q-icon(name='attach_file', size='16px')
              span {{ fileLabel(file) }}
              q-spinner(v-if='openingId === file.id', size='14px')
            .file-row__meta.t-muted(v-if='uploaderName(file.uploaded_by_username) || file.uploaded_at')
              span(v-if='uploaderName(file.uploaded_by_username)') {{ uploaderName(file.uploaded_by_username) }}
              span(v-if='file.uploaded_at') {{ (uploaderName(file.uploaded_by_username) ? ' · ' : '') + formatDate(String(file.uploaded_at)) }}

    //- История состояний — собирается из фактов в данных (даты СЗ, подписи
    //- заявления/решения, загруженные документы, статус). Тот же виджет, что на
    //- странице расхода программы Благорост.
    .section(v-if='timeline.length')
      .t-eyebrow.t-muted История состояний
      BaseCard
        ActivityTimeline(:events='timeline', group-by-date)

  EmptyState(
    v-else-if='!loading && loaded',
    title='Расход не найден',
    body='Возможно, ссылка устарела или у вас нет доступа.'
  )
    template(#icon)
      q-icon(name='error_outline', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { DataRow } from 'src/shared/ui/domain';
import { ExpenseProposalDocuments } from 'src/shared/ui/domain/ExpenseProposalDocuments';
import { ActivityTimeline } from 'src/shared/ui/domain/ActivityTimeline';
import type { ActivityEvent, ActivityEventType } from 'src/shared/ui/domain/ActivityTimeline';
import { PaymentDetails } from 'src/shared/ui';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { listExpenseWallets } from 'src/shared/lib/expense-wallets';
import { api as paymentApi } from 'src/entities/Payment/api';
import type { IPayment } from 'src/entities/Payment';
import {
  getExpenseProposal,
  getExpenseFilesByProposal,
  getExpenseFileReadUrl,
  type IExpenseProposalResult,
  type IExpenseFilesByProposalResult,
} from '../api';
import {
  getExpenseProposalStatusLabel,
  getExpenseProposalStatusVariant,
  getExpenseItemStatusLabel,
  getExpenseItemStatusVariant,
  getExpenseMechanicsLabel,
} from '../model';

type IProposal = NonNullable<IExpenseProposalResult>;
type IFileRow = IExpenseFilesByProposalResult[number];

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const loaded = ref(false);
const proposal = ref<IProposal | null>(null);
const files = ref<IFileRow[]>([]);
const linkedPayments = ref<IPayment[]>([]);
const loadingPayments = ref(false);

// Статус платежа → canon-вариант бейджа (как в реестре платежей).
const paymentStatusVariantMap: Record<string, BaseBadgeVariant> = {
  [Zeus.PaymentStatus.COMPLETED]: 'pos',
  [Zeus.PaymentStatus.PAID]: 'info',
  [Zeus.PaymentStatus.PENDING]: 'warn',
  [Zeus.PaymentStatus.PROCESSING]: 'warn',
  [Zeus.PaymentStatus.FAILED]: 'neg',
  [Zeus.PaymentStatus.CANCELLED]: 'neg',
  [Zeus.PaymentStatus.REFUNDED]: 'neutral',
  [Zeus.PaymentStatus.EXPIRED]: 'neutral',
};
function paymentStatusVariant(status?: string | null): BaseBadgeVariant {
  return (status && paymentStatusVariantMap[status]) || 'neutral';
}
function paymentDirectionIcon(pay: IPayment): string {
  return pay.direction === Zeus.PaymentDirection.INCOMING ? 'south_west' : 'north_east';
}
function paymentAmount(pay: IPayment): string {
  return `${pay.quantity ?? ''} ${pay.symbol ?? ''}`.trim();
}

// Платёж → событие истории состояний. Тип/иконка/текст по текущему статусу:
// исполнен (деньги ушли), оплачен кассой (ждём цепочку), создан, отклонён.
function paymentTimelineEvent(pay: IPayment): ActivityEvent {
  const label = pay.type_label || pay.type || 'Платёж';
  let type: ActivityEventType = 'transfer';
  let icon = pay.direction === Zeus.PaymentDirection.INCOMING ? 'south_west' : 'payments';
  let title = `${label} — создан, ожидает кассу`;
  switch (pay.status) {
    case Zeus.PaymentStatus.COMPLETED:
      type = 'sign';
      title = `${label} — исполнен`;
      break;
    case Zeus.PaymentStatus.PAID:
      title = `${label} — оплачен кассой, ждём подтверждения`;
      break;
    case Zeus.PaymentStatus.CANCELLED:
      type = 'reject';
      icon = 'block';
      title = `${label} — отклонён`;
      break;
    case Zeus.PaymentStatus.FAILED:
      type = 'reject';
      icon = 'error';
      title = `${label} — ошибка`;
      break;
    case Zeus.PaymentStatus.PENDING:
    case Zeus.PaymentStatus.PROCESSING:
      icon = 'schedule';
      break;
    default:
      break;
  }
  const reason =
    pay.status === Zeus.PaymentStatus.CANCELLED || pay.status === Zeus.PaymentStatus.FAILED
      ? pay.message
      : '';
  const description = [formatAmount(paymentAmount(pay)), reason]
    .filter(Boolean)
    .join(' · ');
  return {
    id: `payment-${pay.hash}`,
    type,
    icon,
    title,
    description: description || undefined,
    date: String(pay.updated_at ?? pay.created_at ?? ''),
  };
}

// Все платежи расхода — одним запросом по proposal_hash (gateway-фильтр по
// json-полю blockchain_data.proposal_hash). Связь платёж→расход зашита в данные
// бэкендом при создании платежа, поэтому фронт ничего не реконструирует и не
// дублирует серверных формул хэшей: спрашиваем по расходу — получаем все
// связанные платежи любого типа (выдача/оплата, возврат, доплата).
const PAYMENT_TYPE_ORDER: Record<string, number> = {
  [Zeus.PaymentType.EXPENSE]: 0,
  [Zeus.PaymentType.EXPENSE_RETURN]: 1,
  [Zeus.PaymentType.EXPENSE_OVERSPEND]: 1,
};
async function loadLinkedPayments(): Promise<void> {
  const coopname = route.params.coopname as string;
  const proposal_hash = proposal.value?.proposal_hash;
  if (!coopname || !proposal_hash) return;
  try {
    loadingPayments.value = true;
    const result = await paymentApi.loadPayments(
      { coopname, proposal_hash },
      { page: 1, limit: 100, sortOrder: 'DESC' },
    );
    // Выдача/оплата (EXPENSE) — раньше расчётных платёжек (возврат/доплата).
    linkedPayments.value = [...(result.items ?? [])].sort(
      (a, b) =>
        (PAYMENT_TYPE_ORDER[a.type ?? ''] ?? 9) -
        (PAYMENT_TYPE_ORDER[b.type ?? ''] ?? 9),
    );
  } catch (e) {
    FailAlert(e);
  } finally {
    loadingPayments.value = false;
  }
}

// Возврат к реестру расходов (back-link под шапкой) — туда, откуда
// проваливаются в деталь конкретного расхода.
function goBack(): void {
  void router.push({
    name: 'expenses-registry',
    params: { coopname: route.params.coopname },
  });
}

// Клик по платежу → реестр платежей кассира, отфильтрованный по владельцу
// платежа, с фокусом на конкретный платёж (виджет раскроет его по hash).
function openInRegistry(pay: IPayment): void {
  void router.push({
    name: 'payments',
    params: { coopname: route.params.coopname, username: pay.username },
    query: { focus: pay.hash },
  });
}

function proposalStatusLabel(status?: Zeus.ExpenseProposalStatus | null): string {
  return getExpenseProposalStatusLabel(status);
}

function proposalStatusVariant(status?: Zeus.ExpenseProposalStatus | null) {
  return getExpenseProposalStatusVariant(status);
}

function itemStatusLabel(status?: Zeus.ExpenseItemStatus | null): string {
  return getExpenseItemStatusLabel(status);
}

function itemStatusVariant(status?: Zeus.ExpenseItemStatus | null) {
  return getExpenseItemStatusVariant(status);
}

function mechanicsLabel(mechanics?: Zeus.ExpenseMechanics | null): string {
  return getExpenseMechanicsLabel(mechanics);
}

// Код кошелька-пула → человеческое имя из реестра пулов (fallback — сам код).
const walletTitles = new Map(listExpenseWallets().map((e) => [e.wallet, e.title]));
function walletLabel(code?: string | null): string {
  if (!code) return '—';
  return walletTitles.get(code) ?? code;
}

function formatAmount(asset?: string | null): string {
  if (!asset) return '—';
  return formatAsset2Digits(asset);
}

type ISignature = NonNullable<
  NonNullable<NonNullable<IProposal['statement_doc']>['document']>['signatures']
>[number];

// ФИО пайщика — из сертификата подписанта служебной записки (её подписывает
// создатель). Доп. запрос аккаунта не нужен — сертификат уже в агрегате.
const creatorName = computed(() => {
  const cert = proposal.value?.statement_doc?.document?.signatures?.[0]?.signer_certificate;
  return (cert ? getNameFromCertificate(cert) : '') || proposal.value?.username || '—';
});

// Карта «аккаунт → сертификат» из всех подписей расхода (СЗ + протокол) —
// чтобы показать ФИО того, кто приложил чек, а не имя его аккаунта.
const signerCerts = computed(() => {
  const map = new Map<string, ISignature['signer_certificate']>();
  const collect = (doc: IProposal['statement_doc']): void => {
    (doc?.document?.signatures ?? []).forEach((s) => {
      if (s.signer && s.signer_certificate) map.set(s.signer, s.signer_certificate);
    });
  };
  collect(proposal.value?.statement_doc);
  collect(proposal.value?.decision_doc);
  return map;
});
function uploaderName(username?: string | null): string {
  if (!username) return '';
  const cert = signerCerts.value.get(username);
  return cert ? getNameFromCertificate(cert) : '';
}

// Документы показываем каноном, только если пришёл их html (rawDocument).
const hasDocuments = computed(() =>
  Boolean(proposal.value?.statement_doc?.rawDocument?.html)
  || Boolean(proposal.value?.decision_doc?.rawDocument?.html),
);

const itemsCount = computed(() => proposal.value?.items?.length ?? 0);
const itemsCountLabel = computed(
  () => `${itemsCount.value} ${pluralRu(itemsCount.value, 'строка', 'строки', 'строк')}`,
);

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

function fileLabel(file: IFileRow): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at ? new Date(String(file.uploaded_at)).toLocaleString('ru-RU') : '';
  return `документ от ${date}`;
}

// История состояний собирается из фактов, которые уже есть в данных: дат СЗ,
// подписей документов (заявление/решение) и загруженных документов. Отдельной
// журнальной таблицы у шасси нет — финальные статусы контракт хранит в рабочем
// состоянии, история действий живёт в парсере.
function firstSignatureDate(doc: IProposal['statement_doc']): string | null {
  const signatures = doc?.document?.signatures;
  if (!signatures?.length) return null;
  return signatures[0]?.signed_at ?? null;
}

const timeline = computed<ActivityEvent[]>(() => {
  const p = proposal.value;
  if (!p) return [];
  const events: ActivityEvent[] = [
    {
      id: 'created',
      type: 'create',
      title: 'Служебная записка создана',
      actor: creatorName.value,
      date: p.created_at ?? '',
    },
  ];

  const statementSigned = firstSignatureDate(p.statement_doc);
  if (statementSigned) {
    events.push({
      id: 'statement',
      type: 'sign',
      title: 'Заявление на расход подписано',
      actor: creatorName.value,
      date: statementSigned,
    });
  }

  const decisionSigned = firstSignatureDate(p.decision_doc);
  if (decisionSigned || p.status === Zeus.ExpenseProposalStatus.DECLINED) {
    const declined = p.status === Zeus.ExpenseProposalStatus.DECLINED;
    events.push({
      id: 'decision',
      type: declined ? 'reject' : 'sign',
      title: declined
        ? 'Совет отклонил расход'
        : 'Совет утвердил расход — протокол решения подписан',
      date: decisionSigned ?? p.updated_at ?? '',
    });
  }

  files.value.forEach((f) => {
    events.push({
      id: `file-${f.id}`,
      type: 'update',
      title: 'Приложен документ',
      description: fileLabel(f),
      date: String(f.uploaded_at ?? p.updated_at ?? ''),
    });
  });

  // Движения денег по расходу — выдача аванса/оплата организации, возврат
  // недорасхода, доплата перерасхода, отклонения. Берём из тех же платежей,
  // что и секция «Платежи по расходу» (linkedPayments) — без отдельного запроса.
  linkedPayments.value.forEach((pay) => {
    events.push(paymentTimelineEvent(pay));
  });

  if (p.status === Zeus.ExpenseProposalStatus.REPORT_SUBMITTED) {
    events.push({
      id: 'report',
      type: 'system',
      title: 'Отчёт по смете подан — ожидает закрытия расхода',
      date: p.updated_at ?? '',
    });
  }
  if (p.status === Zeus.ExpenseProposalStatus.CLOSED) {
    events.push({
      id: 'closed',
      type: 'system',
      title: 'Расход закрыт — фактическая сумма капитализирована',
      date: p.updated_at ?? '',
    });
  }

  return events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
});

// Списочные запросы файлов отдают короткоживущий read_url — свежую ссылку
// запрашиваем по id в момент клика, открываем в новой вкладке.
const openingId = ref<number | null>(null);
async function openFile(file: IFileRow): Promise<void> {
  try {
    openingId.value = file.id;
    const url = await getExpenseFileReadUrl(file.id);
    if (!url) throw new Error('Не удалось получить ссылку на файл');
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    FailAlert(e);
  } finally {
    openingId.value = null;
  }
}

async function load(): Promise<void> {
  const proposalHash = route.params.hash as string;
  const coopname = route.params.coopname as string;
  if (!proposalHash) return;
  try {
    loading.value = true;
    const proposalResult = await getExpenseProposal({ proposal_hash: proposalHash });
    proposal.value = proposalResult as IProposal | null;

    if (coopname && proposal.value) {
      try {
        const filesResult = await getExpenseFilesByProposal({
          coopname,
          proposal_hash: proposalHash,
        });
        files.value = filesResult ?? [];
      } catch (e) {
        FailAlert(e);
      }
    }

    if (proposal.value) void loadLinkedPayments();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

onMounted(() => {
  void load();
});
</script>

<style lang="scss" scoped>
.expense-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.expense-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-4, 16px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.expense-back:hover {
  color: var(--p-ink);
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-3);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.items-head {
  margin-bottom: var(--p-2);
  font-size: var(--p-fs-body-sm);
}

.table-scroll {
  overflow-x: auto;
}

/* Глобальный канон форсит .table{min-width:0!important} → колонки схлопываются
   и текст рвётся посимвольно; перебиваем !important (эталон — реестр платежей). */
.table {
  table-layout: fixed !important;
  min-width: 560px !important;
}

.col-num {
  width: 110px;
  white-space: nowrap;
  text-align: right;
}

.cell-name {
  overflow-wrap: break-word;
}

.pay-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.pay-item {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding-bottom: var(--p-3);
  border-bottom: 1px solid var(--p-line);
}

.pay-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.pay-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  flex-wrap: wrap;
}

.pay-item__title {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  font-weight: 600;
  color: var(--p-ink);
}

.pay-item__amount {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  white-space: nowrap;
}

.pay-item__link {
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

.files {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.file-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
}

.file-row:last-child {
  border-bottom: none;
}

.file-row__meta {
  font-size: var(--p-fs-body-sm);
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
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
