<template lang="pug">
.q-pa-md
  .ndfl-page
    PageHint(storage-key='reports:ndfl:banner-dismissed')
      | Удерживая налог с выплат физическим лицам, кооператив выступает налоговым
      | агентом: деньги остаются на расчётном счёте, а долг перед бюджетом
      | копится. Гасится он единым налоговым платежом — бухгалтер отправляет
      | накопленное на оплату, кассир перечисляет по реквизитам налоговой и
      | прикладывает чек. Расчётный период платежа — тот же, за который подаётся
      | уведомление об исчисленных суммах НДФЛ.

    .ndfl-card
      .ndfl-card__stat
        .ndfl-card__label Удержанный налог к перечислению
        .ndfl-card__value
          span.ndfl-card__amount {{ withheldDisplay }}
        .ndfl-card__caption
          template(v-if='hasInPayment')
            | из них {{ inPaymentDisplay }} уже у кассира на оплате
          template(v-else)
            | НДФЛ, удержанный с выплат доходов физическим лицам
      BaseButton.ndfl-card__action(
        variant='secondary',
        size='sm',
        :disabled='stateLoading || availableAmount <= 0',
        @click='openPayDialog'
      )
        template(#icon-left)
          q-icon(name='account_balance', size='16px')
        | Отправить на оплату

    h2.ndfl-page__section-title Перечисления

    TableSkeleton(
      v-if='paymentsLoading && !payments.length',
      :columns='skeletonColumns',
      :rows='4',
      min-width='900px'
    )

    .table-wrap(v-else-if='payments.length')
      .table-scroll
        table.table
          thead
            tr
              th.col-date Отправлен
              th.col-num Сумма
              th.col-period Расчётный период
              th Состояние
              th.col-date Оплачен
              th.col-chevron
          tbody
            template(v-for='row in payments', :key='row.hash')
              tr.data-row(@click='toggleRow(row.hash)')
                td.col-date {{ formatDateTime(row.created_at) }}
                td.col-num {{ formatAmount(row.amount) }}
                td.col-period {{ periodLabel(row) }}
                td
                  BaseBadge(:variant='statusVariant(row.status)') {{ statusLabel(row.status) }}
                td.col-date {{ formatDateTime(row.completed_at) }}
                td.col-chevron
                  q-icon(:name='expanded.has(row.hash) ? "expand_less" : "expand_more"', size='20px')
              tr.expand-row(v-if='expanded.has(row.hash)')
                td(colspan='6')
                  .ndfl-details
                    .banner.banner--neg(v-if='row.message')
                      .banner__icon
                        q-icon(name='block', size='sm')
                      .banner__body
                        .t-sm.t-muted Кассир не смог заплатить. Причина:
                        div {{ row.message }}
                    DataRow(label='Назначение платежа', :value='row.memo', copyable)
                    DataRow(
                      v-if='row.recipient_name',
                      label='Получатель',
                      :value='row.recipient_name',
                      copyable
                    )
                    DataRow(
                      v-for='requisite in row.requisite_rows || []',
                      :key='requisite.label',
                      :label='requisite.label',
                      :value='requisite.value',
                      copyable,
                      mono
                    )
                    AttachPaymentProofPanel(:payment-hash='row.hash', readonly)

      .table-foot
        span {{ rangeLabel }}
        BaseButton(
          v-if='hasMore',
          variant='ghost',
          size='sm',
          :loading='paymentsLoading',
          @click='loadMore'
        ) Загрузить ещё

    EmptyState(
      v-else,
      title='Перечислений пока не было',
      body='Здесь появятся платежи в бюджет: сумма, расчётный период и чек кассира.'
    )
      template(#icon)
        q-icon(name='account_balance', size='48px')

  BaseDialog(v-model='payDialogOpen', title='Перечисление налога в бюджет', size='sm')
    p.ndfl-page__dialog-hint
      | Заявка уйдёт кассиру в реестр исходящих платежей — он перечислит сумму
      | по реквизитам налоговой и подтвердит перевод. Доступно к перечислению
      | {{ availableDisplay }}: больше удержанного отправить нельзя.
    AmountInput(
      v-model='draftAmount',
      label='Сумма платежа',
      symbol='₽',
      :precision='2',
      :min='0',
      :max='availableAmount',
      :disabled='paying'
    )
    template(#footer)
      BaseButton(variant='ghost', :disabled='paying', @click='payDialogOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='paying',
        :disabled='!canPay',
        @click='onPay'
      ) Отправить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { AmountInput, DataRow, PageHint } from 'src/shared/ui/domain';
import { AttachPaymentProofPanel } from 'src/features/Payment/AttachPaymentProof';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { paymentStatusLabel, paymentStatusVariant } from 'src/shared/lib/payment';
import {
  getWithheldTaxPayments,
  getWithheldTaxState,
  payWithheldTax,
  type IWithheldTaxPayment,
} from './ndfl-api';

/**
 * Стол бухгалтера → «НДФЛ»: долг перед бюджетом и история его погашения.
 *
 * Раздел отдельный, потому что перечисление налога не принадлежит ни одному
 * реестру стола: это не проводка, не кошелёк и не форма отчётности, а
 * обязанность налогового агента, у которой свой жизненный цикл — удержали,
 * отправили кассиру, он заплатил и приложил чек. Расчётный период у платежа
 * тот же, что у уведомления об исчисленных суммах, поэтому связь с календарём
 * читается прямо из строки.
 */

const PAGE_LIMIT = 20;

const stateLoading = ref(false);
const paymentsLoading = ref(false);
const paying = ref(false);
const payDialogOpen = ref(false);

const withheld = ref('');
const inPayment = ref('');
const available = ref('');
const draftAmount = ref(0);

const payments = ref<IWithheldTaxPayment[]>([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalCount = ref(0);
const expanded = ref(new Set<string>());

const skeletonColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Отправлен', class: 'col-date', cell: 'text', cellWidth: '140px' },
  { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '120px' },
  { label: 'Расчётный период', class: 'col-period', cell: 'text', cellWidth: '180px' },
  { label: 'Состояние', cell: 'badge' },
  { label: 'Оплачен', class: 'col-date', cell: 'text', cellWidth: '140px' },
  { label: '', class: 'col-chevron', cell: 'text', cellWidth: '40px' },
]);

function assetToNumber(asset: string): number {
  const parsed = Number.parseFloat((asset || '').split(' ')[0] ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

const withheldDisplay = computed(() => formatAsset2Digits(withheld.value || '0.0000 RUB'));
const inPaymentDisplay = computed(() => formatAsset2Digits(inPayment.value || '0.0000 RUB'));
const availableDisplay = computed(() => formatAsset2Digits(available.value || '0.0000 RUB'));
const availableAmount = computed(() => assetToNumber(available.value));
const hasInPayment = computed(() => assetToNumber(inPayment.value) > 0);
const canPay = computed(
  () => draftAmount.value > 0 && draftAmount.value <= availableAmount.value,
);

const hasMore = computed(() => currentPage.value < totalPages.value);

const rangeLabel = computed(() => {
  const shown = payments.value.length;
  return shown ? `1–${shown} из ${totalCount.value}` : `0 из ${totalCount.value}`;
});

function formatAmount(asset?: string | null): string {
  if (!asset) return '—';
  return formatAsset2Digits(asset);
}

// Даты приходят скаляром DateTime — в типах SDK это unknown, нормализуем здесь
function formatDateTime(value?: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/** «Август · 1–22» плюс год: два периода одного месяца иначе не различить. */
function periodLabel(row: IWithheldTaxPayment): string {
  return `${row.report_period_label} · ${row.report_year}`;
}

function statusLabel(status: string): string {
  return paymentStatusLabel(status);
}

function statusVariant(status: string) {
  return paymentStatusVariant(status);
}

function toggleRow(hash: string): void {
  const next = new Set(expanded.value);
  if (next.has(hash)) next.delete(hash);
  else next.add(hash);
  expanded.value = next;
}

async function loadState(): Promise<void> {
  stateLoading.value = true;
  try {
    const state = await getWithheldTaxState();
    withheld.value = state.withheld;
    inPayment.value = state.in_payment;
    available.value = state.available;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить удержанный налог');
  } finally {
    stateLoading.value = false;
  }
}

async function loadPayments(page = 1): Promise<void> {
  paymentsLoading.value = true;
  try {
    const result = await getWithheldTaxPayments(page, PAGE_LIMIT);
    const incoming = result.items ?? [];
    payments.value = page === 1 ? incoming : [...payments.value, ...incoming];
    currentPage.value = result.currentPage ?? page;
    totalPages.value = result.totalPages ?? 1;
    totalCount.value = result.totalCount ?? payments.value.length;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить историю перечислений');
  } finally {
    paymentsLoading.value = false;
  }
}

function loadMore(): void {
  if (paymentsLoading.value || !hasMore.value) return;
  void loadPayments(currentPage.value + 1);
}

function openPayDialog(): void {
  // Платят обычно всё накопленное — предзаполняем, но оставляем правку:
  // часть суммы может относиться к следующему сроку перечисления.
  draftAmount.value = availableAmount.value;
  payDialogOpen.value = true;
}

async function onPay(): Promise<void> {
  paying.value = true;
  try {
    const paid = await payWithheldTax({ amount: Number(draftAmount.value) });
    payDialogOpen.value = false;
    SuccessAlert(`Отправлено на оплату: ${formatAsset2Digits(paid)}. Заявка ушла кассиру.`);
    await Promise.all([loadState(), loadPayments(1)]);
  } catch (e) {
    FailAlert(e, 'Не удалось отправить налог на оплату');
  } finally {
    paying.value = false;
  }
}

onMounted(() => {
  void loadState();
  void loadPayments(1);
});
</script>

<style lang="scss" scoped>
.ndfl-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.ndfl-page__section-title {
  margin: var(--p-2) 0 0;
  font-size: var(--p-fs-h3, 15px);
  line-height: var(--p-lh-h3, 1.3);
  font-weight: 600;
  color: var(--p-ink);
}

.ndfl-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  background: var(--p-surface);
  padding: var(--p-5) var(--p-6);
}

.ndfl-card__label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  margin-bottom: var(--p-1);
}

.ndfl-card__caption {
  margin-top: var(--p-1);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.ndfl-card__value {
  display: flex;
  align-items: baseline;
  gap: var(--p-1);
  color: var(--p-ink);
}

.ndfl-card__amount {
  font-size: var(--p-fs-h1, 24px);
  line-height: var(--p-lh-h1, 1.2);
  letter-spacing: var(--p-ls-h1, -0.018em);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
}

.ndfl-card__action {
  flex-shrink: 0;
}

.ndfl-page__dialog-hint {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.ndfl-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3) 0;
}

.table-scroll {
  overflow-x: auto;
}

/* Глобальный канон форсит .table{min-width:0!important} — без !important
   колонки схлопываются уже контента и текст рвётся посимвольно в столбик. */
.table {
  table-layout: fixed !important;
  min-width: 900px !important;
}

@media (max-width: 599px) {
  .ndfl-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
