<template lang="pug">
.payments-table
  TableSkeleton(
    v-if='onLoading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    :min-width='hideActions ? "940px" : "1000px"'
  )
  template(v-else-if='items.length')
    //- Десктоп: канон-таблица. На мобиле скрыта — таблица из 7–8 колонок
    //- нечитаема на телефоне (глобальный канон ломает её посимвольным
    //- переносом), поэтому ниже идёт карточная раскладка.
    .table-wrap.pmt-desktop
      .table-scroll
        table.table(:class='{ "table--actions": !hideActions }')
          thead
            tr
              th.col-toggle
              th.col-sort(@click='onSort("username")') Пайщик {{ sortMark('username') }}
              th.col-sort.col-date(@click='onSort("created_at")') Дата создания {{ sortMark('created_at') }}
              th.col-sort.col-num(@click='onSort("quantity")') Сумма {{ sortMark('quantity') }}
              th Тип платежа
              //- «Направление» — относительно того, чей это стол: на столе совета
              //- относительно кооператива (в/из кооператива), на личном столе
              //- пайщика относительно пайщика (поступление/списание) — см. displayDirection.
              th Направление
              th.col-sort(@click='onSort("status")') Статус {{ sortMark('status') }}
              th.col-action(v-if='!hideActions') Действия
          tbody
            template(v-for='row in items', :key='row.id')
              tr.data-row(:id='`pay-row-${row.id}`', @click='toggleExpand(row.id)')
                td.col-toggle
                  button.icon-btn(
                    type='button',
                    :aria-label='expanded.get(row.id) ? "Свернуть" : "Развернуть"',
                    @click.stop='toggleExpand(row.id)'
                  )
                    q-icon(:name='expanded.get(row.id) ? "expand_more" : "chevron_right"')
                td.cell-name {{ getShortNameFromCertificate(row.username_certificate) || row.username }}
                td {{ formatDateToHumanDateTime(row.created_at) }}
                td.col-num {{ amountLabel(row) }}
                td {{ row.type_label }}
                td
                  span.dir(:class='isIncoming(displayDirection(row)) ? "dir--in" : "dir--out"')
                    q-icon.q-mr-xs(:name='getDirectionIcon(displayDirection(row))', size='16px')
                    span {{ directionLabel(row) }}
                    q-tooltip {{ directionHint(row) }}
                td
                  .cell-status
                    BaseBadge(:variant='getStatusVariant(row.status)') {{ row.status_label }}
                    //- Статус отчёта по авансу (личный стол пайщика) — отдельная ось
                    //- рядом со статусом платежа: требуется / подан / принят.
                    BaseBadge(v-if='reportBadge(row)', :variant='reportBadge(row)?.variant') {{ reportBadge(row)?.label }}
                    //- Кассирская отметка «платёжка приложена» — только на столе совета
                    //- (пайщику чужая бухгалтерия не показывается).
                    q-icon.proof-icon.proof-icon--ok(v-if='!hideActions && proofState(row) === "attached"', name='receipt_long', size='16px')
                      q-tooltip Платёжка приложена
                    q-icon.proof-icon.proof-icon--missing(v-else-if='!hideActions && proofState(row) === "missing"', name='receipt_long', size='16px')
                      q-tooltip Платёжка не приложена
                td.col-action(v-if='!hideActions', @click.stop)
                  .cell-actions(v-if='["EXPIRED", "PENDING", "FAILED"].includes(row.status)')
                    SetOrderPaidStatusButton(:id='row.id')
                    //- Возврат вступительного взноса отклонить нельзя — совет уже
                    //- отказал, кассир обязан вернуть деньги. Прячем «Отклонить».
                    SetOrderRefundedStatusButton(v-if='!isRefundType(row.type)', :id='row.id')
                  span.no-actions(v-else) —

              tr.expand-row(v-if='expanded.get(row.id)')
                td(:colspan='hideActions ? 7 : 8')
                  PaymentDetails(:payment='row')
                  //- Стол совета: кассир прикладывает платёжку и закрывающие документы;
                  //- при личной передаче чеков — отчитывается за пайщика (панель
                  //- отчёта сама скрывается для прямой оплаты организации, DIRECT).
                  .expense-flow.q-mt-sm(v-if='!hideActions && expenseProofRef(row)')
                    AttachExpenseProofPanel(
                      :proposal-hash='expenseProofRef(row)?.proposal_hash ?? ""',
                      :item-hash='expenseProofRef(row)?.item_hash ?? ""',
                      :step='{ number: 1, title: "Подтвердите оплату" }',
                      @uploaded='onProofUploaded(row)'
                    )
                    ReportExpenseAdvancePanel(
                      :proposal-hash='expenseProofRef(row)?.proposal_hash ?? ""',
                      :item-hash='expenseProofRef(row)?.item_hash ?? ""',
                      :on-behalf='true',
                      :report-state='advanceReportState(row)',
                      :reported-amount='advanceReportedAmount(row)',
                      :step='{ number: 2, title: "Отчёт пайщика" }',
                      @reported='onReported'
                    )
                  //- Личный стол: пайщик-получатель отчитывается чеком по своей строке.
                  ReportExpenseAdvancePanel.q-mt-sm(
                    v-else-if='advanceReportRef(row)',
                    :proposal-hash='advanceReportRef(row)?.proposal_hash ?? ""',
                    :item-hash='advanceReportRef(row)?.item_hash ?? ""',
                    :report-state='advanceReportState(row)',
                    :reported-amount='advanceReportedAmount(row)',
                    @reported='onReported'
                  )
                  //- Расчётная платёжка (возврат/доплата): кассиру/пайщику видно
                  //- основание — исходный аванс, заявленный факт и документы.
                  ExpenseSettlementBasisPanel.q-mt-sm(
                    v-if='settlementRef(row)',
                    :proposal-hash='settlementRef(row)?.proposal_hash ?? ""',
                    :item-hash='settlementRef(row)?.item_hash ?? ""',
                    :settlement-amount='`${row.quantity} ${row.symbol}`',
                    :is-return='settlementRef(row)?.isReturn ?? false',
                    :description='settlementRef(row)?.description ?? ""',
                    @open-source='openSourcePayment'
                  )

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='onLoading',
          @click='loadMore'
        ) Загрузить ещё

    //- Мобайл: карточки вместо таблицы. Видны только на узких экранах.
    .payments-cards.pmt-mobile
      .pay-card(v-for='row in items', :key='row.id', :id='`pay-card-${row.id}`')
        .pay-card__main(@click='toggleExpand(row.id)')
          .pay-card__row
            span.pay-card__name {{ getShortNameFromCertificate(row.username_certificate) || row.username }}
            .cell-status
              BaseBadge(:variant='getStatusVariant(row.status)') {{ row.status_label }}
              BaseBadge(v-if='reportBadge(row)', :variant='reportBadge(row)?.variant') {{ reportBadge(row)?.label }}
              q-icon.proof-icon.proof-icon--ok(v-if='!hideActions && proofState(row) === "attached"', name='receipt_long', size='16px')
                q-tooltip Платёжка приложена
              q-icon.proof-icon.proof-icon--missing(v-else-if='!hideActions && proofState(row) === "missing"', name='receipt_long', size='16px')
                q-tooltip Платёжка не приложена
          .pay-card__row
            span.pay-card__amount
              q-icon.q-mr-xs(
                :name='getDirectionIcon(displayDirection(row))',
                :class='isIncoming(displayDirection(row)) ? "dir--in" : "dir--out"',
                size='16px'
              )
              | {{ amountLabel(row) }}
            span.pay-card__type {{ row.type_label }}
          .pay-card__row.pay-card__row--meta
            span {{ directionLabel(row) }}
            span {{ formatDateToHumanDateTime(row.created_at) }}
        .pay-card__actions(
          v-if='!hideActions && ["EXPIRED", "PENDING", "FAILED"].includes(row.status)',
          @click.stop
        )
          SetOrderPaidStatusButton(:id='row.id')
          SetOrderRefundedStatusButton(v-if='!isRefundType(row.type)', :id='row.id')
        template(v-if='expanded.get(row.id)')
          PaymentDetails.pay-card__details(:payment='row')
          .expense-flow.q-mt-sm(v-if='!hideActions && expenseProofRef(row)')
            AttachExpenseProofPanel(
              :proposal-hash='expenseProofRef(row)?.proposal_hash ?? ""',
              :item-hash='expenseProofRef(row)?.item_hash ?? ""',
              :step='{ number: 1, title: "Подтвердите оплату" }',
              @uploaded='onProofUploaded(row)'
            )
            ReportExpenseAdvancePanel(
              :proposal-hash='expenseProofRef(row)?.proposal_hash ?? ""',
              :item-hash='expenseProofRef(row)?.item_hash ?? ""',
              :on-behalf='true',
              :report-state='advanceReportState(row)',
              :reported-amount='advanceReportedAmount(row)',
              :step='{ number: 2, title: "Отчёт пайщика" }',
              @reported='onReported'
            )
          ReportExpenseAdvancePanel.q-mt-sm(
            v-else-if='advanceReportRef(row)',
            :proposal-hash='advanceReportRef(row)?.proposal_hash ?? ""',
            :item-hash='advanceReportRef(row)?.item_hash ?? ""',
            :report-state='advanceReportState(row)',
            :reported-amount='advanceReportedAmount(row)',
            @reported='onReported'
          )
          ExpenseSettlementBasisPanel.q-mt-sm(
            v-if='settlementRef(row)',
            :proposal-hash='settlementRef(row)?.proposal_hash ?? ""',
            :item-hash='settlementRef(row)?.item_hash ?? ""',
            :settlement-amount='`${row.quantity} ${row.symbol}`',
            :is-return='settlementRef(row)?.isReturn ?? false',
            :description='settlementRef(row)?.description ?? ""',
            @open-source='openSourcePayment'
          )

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='onLoading',
          @click='loadMore'
        ) Загрузить ещё

  EmptyState(
    v-else,
    title='Платежи не найдены',
    body='Здесь появятся ваши платежи и взносы.'
  )
    template(#icon)
      q-icon(name='receipt_long', size='48px')
</template>

<script setup lang="ts">
import { onMounted, ref, computed, reactive, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { usePaymentStore } from 'src/entities/Payment/model';
import { SetOrderPaidStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderPaidStatusButton';
import { SetOrderRefundedStatusButton } from 'src/features/Payment/SetStatus/ui/SetOrderRefundedStatusButton';
import { AttachExpenseProofPanel } from 'src/features/Payment/AttachExpenseProof';
import { ReportExpenseAdvancePanel } from 'src/features/Payment/ReportExpenseAdvance';
import { ExpenseSettlementBasisPanel } from 'src/features/Payment/ExpenseSettlementBasis';
import { useSessionStore } from 'src/entities/Session';
import { PaymentDetails } from 'src/shared/ui';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import type { IPayment } from 'src/entities/Payment/model/types';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import {
  ExpenseReportState,
  reportStateLabel,
  reportStateVariant,
} from 'src/shared/lib/expenses';
import { Zeus } from '@coopenomics/sdk';

const props = defineProps({
  username: {
    type: String,
    required: false,
    default: null,
  },
  hideActions: {
    type: Boolean,
    default: false,
  },
});

const route = useRoute();
const paymentStore = usePaymentStore();
const payments = computed(() => paymentStore.payments);
// Zeus scalar ID не имеет резолвера → IPayment.id типизирован как unknown,
// что ломает шаблонные expanded.get/.set(row.id) и :id-биндинги. Внутри
// виджета сужаем id до string (UI-форма строки): на проводе это всегда
// строковый ID платежа.
type IPaymentRow = Omit<IPayment, 'id'> & { id: string };
const items = computed<IPaymentRow[]>(
  () => (payments.value?.items ?? []) as unknown as IPaymentRow[],
);
const onLoading = ref(false);

// Статус платежа → canon-вариант бейджа (точка + цвет из дизайн-токенов).
const statusVariants: Record<string, BaseBadgeVariant> = {
  [Zeus.PaymentStatus.COMPLETED]: 'pos',
  [Zeus.PaymentStatus.PENDING]: 'warn',
  [Zeus.PaymentStatus.FAILED]: 'neg',
  [Zeus.PaymentStatus.PAID]: 'info',
  [Zeus.PaymentStatus.REFUNDED]: 'neutral',
  [Zeus.PaymentStatus.EXPIRED]: 'neutral',
};
const getStatusVariant = (status?: string | null): BaseBadgeVariant => {
  if (!status) return 'neutral';
  return statusVariants[status] || 'neutral';
};

const isIncoming = (direction?: string | null): boolean =>
  direction === Zeus.PaymentDirection.INCOMING;

// Направление показываем относительно того, чей это стол. on-chain `direction` —
// всегда относительно кооператива (INCOMING = деньги в кооператив). Совет
// (!hideActions) так и видит; на личном столе пайщика (hideActions) перспектива
// обратная (исходящий из кооператива = поступление пайщику), поэтому инвертируем.
const displayDirection = (row: IPaymentRow): string | null | undefined =>
  props.hideActions
    ? (isIncoming(row.direction) ? Zeus.PaymentDirection.OUTGOING : Zeus.PaymentDirection.INCOMING)
    : row.direction;
const directionLabel = (row: IPaymentRow): string =>
  isIncoming(displayDirection(row)) ? 'Входящий' : 'Исходящий';
const directionHint = (row: IPaymentRow): string => {
  const incoming = isIncoming(displayDirection(row));
  return props.hideActions
    ? incoming ? 'Поступление вам' : 'Списание с вас'
    : incoming ? 'В кооператив' : 'Из кооператива';
};

// Сумма — всегда 2 знака после запятой (не сырой on-chain precision=4).
const amountLabel = (row: IPaymentRow): string =>
  formatAsset2Digits(`${row.quantity} ${row.symbol}`);

// Платежи, которые кассир не может отклонить — только «Подтвердить»:
// возврат вступительного/мин.паевого (совет уже отказал в приёме) и оплата
// расхода по СЗ (совет уже утвердил расход; отказ — только решением совета).
const isRefundType = (type?: string | null): boolean =>
  type === Zeus.PaymentType.REGISTRATION_REFUND || type === Zeus.PaymentType.EXPENSE;

// Material-иконки (канон запрещает FontAwesome fa-*).
const getDirectionIcon = (direction?: string | null) => {
  return isIncoming(direction) ? 'arrow_downward' : 'arrow_upward';
};

// Ссылка на позицию СЗ для блока «Подтверждение оплаты»: только у платежей
// расхода и только после подтверждения кассиром (платёжка появляется по факту).
const expenseProofRef = (
  row: IPaymentRow,
): { proposal_hash: string; item_hash: string } | null => {
  if (row.type !== Zeus.PaymentType.EXPENSE) return null;
  if (![Zeus.PaymentStatus.PAID, Zeus.PaymentStatus.COMPLETED].includes(row.status)) return null;
  const data = row.blockchain_data as { proposal_hash?: string; item_hash?: string } | null;
  if (!data?.proposal_hash || !data?.item_hash) return null;
  return { proposal_hash: data.proposal_hash, item_hash: data.item_hash };
};

// Личный реестр пайщика (hideActions): получатель аванса под отчёт прикладывает
// чек и подаёт отчёт по своей позиции. Механику (ADVANCE/DIRECT) панель
// проверяет сама по данным СЗ и для DIRECT не отображается.
const session = useSessionStore();
const advanceReportRef = (
  row: IPaymentRow,
): { proposal_hash: string; item_hash: string } | null => {
  if (!props.hideActions) return null;
  if (row.username !== session.username) return null;
  return expenseProofRef(row);
};

// Зеркало состояния отчёта и заявленной суммы (blockchain_data платежа выдачи
// аванса) — панель отчёта прячет форму после подачи и показывает заявленный факт.
const advanceReportState = (row: IPaymentRow): string =>
  (row.blockchain_data as { report_state?: string } | null)?.report_state ?? '';
const advanceReportedAmount = (row: IPaymentRow): string =>
  (row.blockchain_data as { reported_amount?: string } | null)?.reported_amount ?? '';

// Расчётная платёжка (возврат недорасхода / доплата перерасхода) — ссылка на
// исходную позицию-аванс, чтобы кассир видел основание (аванс/факт/документы),
// не выискивая исходный платёж среди сотен строк реестра.
const settlementRef = (
  row: IPaymentRow,
): { proposal_hash: string; item_hash: string; isReturn: boolean; description: string } | null => {
  const isReturn = row.type === Zeus.PaymentType.EXPENSE_RETURN;
  const isOverspend = row.type === Zeus.PaymentType.EXPENSE_OVERSPEND;
  if (!isReturn && !isOverspend) return null;
  const data = row.blockchain_data as
    | { proposal_hash?: string; item_hash?: string; description?: string }
    | null;
  if (!data?.proposal_hash || !data?.item_hash) return null;
  return {
    proposal_hash: data.proposal_hash,
    item_hash: data.item_hash,
    isReturn,
    description: data.description ?? '',
  };
};

// Статус отчёта по авансу — только на личном столе пайщика и только у платежа
// выдачи аванса (EXPENSE). Источник — зеркало blockchain_data.report_state;
// дефолт «Требуется отчёт», пока пайщик не отчитался. Расчётные платёжки
// (EXPENSE_RETURN/EXPENSE_OVERSPEND) свой отчёт-бейдж не показывают.
const reportBadge = (
  row: IPaymentRow,
): { label: string; variant: BaseBadgeVariant } | null => {
  if (!props.hideActions) return null;
  if (row.type !== Zeus.PaymentType.EXPENSE) return null;
  if (![Zeus.PaymentStatus.PAID, Zeus.PaymentStatus.COMPLETED].includes(row.status)) return null;
  const data = row.blockchain_data as { proposal_hash?: string; report_state?: string } | null;
  if (!data?.proposal_hash) return null;
  const state = (data.report_state as ExpenseReportState) || ExpenseReportState.AWAITING;
  if (state === ExpenseReportState.NOT_REQUIRED) return null;
  return { label: reportStateLabel(state), variant: reportStateVariant(state) };
};

// Отметка отчитанности оплаченного расхода: бэкенд зеркалит число платёжек
// в blockchain_data.proof_count при каждой загрузке/удалении файла.
const proofState = (row: IPaymentRow): 'attached' | 'missing' | 'none' => {
  if (!expenseProofRef(row)) return 'none';
  const count = (row.blockchain_data as { proof_count?: number } | null)?.proof_count ?? 0;
  return count > 0 ? 'attached' : 'missing';
};

// Локально отражаем загруженную платёжку, не перезагружая реестр.
const onProofUploaded = (row: IPaymentRow): void => {
  const data = (row.blockchain_data ?? {}) as { proof_count?: number };
  row.blockchain_data = { ...data, proof_count: (data.proof_count ?? 0) + 1 };
};

// Колонки скелетона повторяют шапку реальной таблицы платежей; колонка
// «Действия» появляется только когда экшены не скрыты — как и в таблице.
const skeletonColumns = computed<TableSkeletonColumn[]>(() => {
  const cols: TableSkeletonColumn[] = [
    { class: 'col-toggle', cell: 'icon' },
    { label: 'Пайщик', cell: 'text' },
    { label: 'Дата создания', cell: 'text', cellWidth: '120px' },
    { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '64px' },
    { label: 'Тип платежа', cell: 'text' },
    { label: 'Направление', cell: 'text', cellWidth: '90px' },
    { label: 'Статус', cell: 'badge' },
  ];
  // «Действия» — только на столе совета (не на личном столе пайщика).
  if (!props.hideActions) {
    cols.push({ label: 'Действия', class: 'col-action', cell: 'icon' });
  }
  return cols;
});

const sortState = reactive({ sortBy: '', sortDir: '' as '' | 'asc' | 'desc' });

const sortMark = (col: string): string => {
  if (sortState.sortBy !== col) return '';
  return sortState.sortDir === 'asc' ? '↑' : '↓';
};

const onSort = (col: string): void => {
  if (sortState.sortBy === col) {
    sortState.sortDir = sortState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.sortBy = col;
    sortState.sortDir = 'asc';
  }
  paymentStore.clear();
  expanded.clear();
  loadPayments(1);
};

const loadPayments = async (page = 1): Promise<void> => {
  try {
    onLoading.value = true;
    const data = props.username ? { username: props.username } : undefined;
    const options = {
      page,
      limit: 25,
      sortBy: sortState.sortBy || undefined,
      sortOrder: sortState.sortDir
        ? (sortState.sortDir.toUpperCase() as 'ASC' | 'DESC')
        : 'ASC',
    };
    await paymentStore.loadPayments(data, options);

    // Платежи с ошибкой разворачиваем сразу — пользователю важна причина.
    items.value.forEach((p) => {
      if (p.status === Zeus.PaymentStatus.FAILED) expanded.set(p.id, true);
    });
  } catch (e: any) {
    FailAlert(e);
  } finally {
    onLoading.value = false;
  }
};

const hasMore = computed(
  () => (payments.value?.currentPage ?? 1) < (payments.value?.totalPages ?? 1),
);

const rangeLabel = computed(() => {
  const total = payments.value?.totalCount ?? items.value.length;
  const shown = items.value.length;
  return shown ? `1–${shown} из ${total}` : `0 из ${total}`;
});

const loadMore = (): void => {
  if (onLoading.value || !hasMore.value) return;
  loadPayments((payments.value?.currentPage ?? 1) + 1);
};

const expanded = reactive(new Map<string | number, boolean>());
const toggleExpand = (id: string | number): void => {
  expanded.set(id, !expanded.get(id));
};

// После отчёта по авансу с недо-/перерасходом заводится отдельная платёжка
// расчёта — перезагружаем реестр и сразу раскрываем её (по хэшу), чтобы пайщик
// увидел реквизиты для оплаты, не догадываясь нажать «развернуть».
const onReported = async (settlementHash?: string): Promise<void> => {
  paymentStore.clear();
  expanded.clear();
  await loadPayments(1);
  if (!settlementHash) return;
  const row = items.value.find((p) => p.hash === settlementHash);
  if (row) expanded.set(row.id, true);
};

// Кассир жмёт «Основание» в расчётной платёжке (возврат/доплата) → раскрываем
// платёж выдачи аванса (его hash == item_hash расчётной платёжки) и прокручиваем
// к нему. Так видно, сколько выдавалось и что в чеке, без поиска строки вручную.
const openSourcePayment = async (itemHash: string): Promise<void> => {
  const target = items.value.find(
    (p) => p.hash?.toLowerCase() === itemHash.toLowerCase(),
  );
  if (!target) {
    FailAlert('Платёж выдачи аванса не найден на текущей странице реестра');
    return;
  }
  expanded.set(target.id, true);
  await nextTick();
  const el =
    document.getElementById(`pay-row-${target.id}`) ??
    document.getElementById(`pay-card-${target.id}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// Пришли из детали расхода по «Открыть в реестре платежей» (?focus=<hash>) —
// после загрузки тихо раскрываем нужный платёж и прокручиваем к нему. Если он
// не на текущей странице — молчим (фильтр по :username? обычно укладывает все
// платежи владельца в одну страницу).
const focusPaymentByHash = async (hash: string): Promise<void> => {
  const target = items.value.find(
    (p) => p.hash?.toLowerCase() === hash.toLowerCase(),
  );
  if (!target) return;
  expanded.set(target.id, true);
  await nextTick();
  const el =
    document.getElementById(`pay-row-${target.id}`) ??
    document.getElementById(`pay-card-${target.id}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

onMounted(async () => {
  paymentStore.clear();
  expanded.clear();
  await loadPayments();
  const focus = route.query.focus;
  if (typeof focus === 'string' && focus) await focusPaymentByHash(focus);
});
</script>

<style lang="scss" scoped>
.payments-table {
  width: 100%;
}

.table-scroll {
  overflow-x: auto;
}

/* Десктоп — таблица, мобайл (≤599px) — карточки. Глобальный канон
   (components.css) форсит .table { min-width:0 !important } + посимвольный
   перенос ячеек на узких экранах, из-за чего таблица из 7–8 колонок
   схлопывается в нечитаемые буквы-в-столбик. Поэтому на телефоне таблицу
   скрываем и показываем карточную раскладку (как реестр документов).
   ВАЖНО: .payments-cards ниже задаёт display:flex с той же специфичностью,
   что и одиночный .pmt-mobile, и перебивал бы display:none по порядку
   источника (карточки лезли на десктоп поверх таблицы). Поэтому скрытие/показ
   вешаем на двойной селектор .payments-cards.pmt-mobile — он специфичнее. */
.payments-cards.pmt-mobile {
  display: none;
}
@media (max-width: 599px) {
  .pmt-desktop {
    display: none;
  }
  .payments-cards.pmt-mobile {
    display: flex;
  }
}

.payments-cards {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.pay-card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
}

.pay-card__main {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  cursor: pointer;
}

.pay-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
}

.pay-card__name {
  font-weight: 500;
  color: var(--p-ink-1);
  /* Имя занимает свободную ширину и обрезается «…», а не рассыпается в
     столбик, когда рядом длинный бейдж статуса. */
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pay-card__amount {
  display: inline-flex;
  align-items: center;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.pay-card__type {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  text-align: right;
  min-width: 0;
  overflow-wrap: break-word;
}

.pay-card__row--meta {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}

.pay-card__actions {
  display: flex;
  gap: var(--p-2, 8px);
  margin-top: var(--p-3, 12px);
}

.pay-card__details {
  margin-top: var(--p-3, 12px);
  padding-top: var(--p-3, 12px);
  border-top: 1px solid var(--p-line);
}

/* Глобальный канон снимает min-width (.table{min-width:0!important}) — без
   него колонки сжимаются уже контента и кнопки действий наезжают на статус.
   Перебиваем !important: при нехватке ширины таблица скроллится в
   .table-scroll, а не схлопывает колонки (как журнал уведомлений). */
.table {
  table-layout: fixed !important;
  min-width: 860px !important;
}
.table--actions {
  min-width: 980px !important;
}

.col-toggle {
  width: 44px;
  text-align: center;
}
.col-date {
  width: 132px;
  white-space: nowrap;
}
.col-action {
  width: 168px;
  text-align: right;
}

.col-sort {
  cursor: pointer;
  user-select: none;
}

/* Действия над платежом — компактной стопкой, прижатой к правому краю
   колонки (td выровнен вправо). Равная ширина кнопок — через align-items:
   stretch внутри inline-flex; слева остаётся воздух от статуса. */
.cell-actions {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--p-2, 8px);
}

.cell-name {
  overflow-wrap: break-word;
}

.dir {
  display: inline-flex;
  align-items: center;
}

.cell-status {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.proof-icon--ok {
  color: var(--p-pos);
}
.proof-icon--missing {
  color: var(--p-warn);
}
.dir--in {
  color: var(--p-pos);
}
.dir--out {
  color: var(--p-neg);
}

.no-actions {
  color: var(--p-ink-3);
}

.data-row {
  cursor: pointer;
}

.expand-row td {
  padding: 0 20px 16px;
  background: var(--p-surface-2);
}

/* Последовательные этапы кассира (подтверждение оплаты → отчёт пайщика):
   разделяем хайрлайном, чтобы видно было «сейчас этот этап, потом следующий». */
.expense-flow {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.expense-flow > * + * {
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>
