<template lang="pug">
.notification-journal
  FilterBar(
    hide-search,
    :filters='filterDefs',
    :model-value='filterValues',
    @update:model-value='onFilterChange'
  )

  template(v-if='store.items.length || store.loading')
    //- Десктоп: канон-таблица; строка открывает правую панель уведомления.
    //- На телефоне скрыта — вместо неё компактные карточки ниже.
    BaseTable.nj-desktop(
      :columns='columns',
      :rows='store.items',
      row-key='id',
      :loading='store.loading && !store.items.length',
      :skeleton-rows='8',
      clickable-rows,
      min-width='960px',
      @row-click='(row) => openDetails(row.id)'
    )
      template(#cell-date='{ row }')
        span {{ formatDateToHumanDateTime(row.createdAt) }}
      template(#cell-recipient='{ row }')
        IdentityCell(
          v-if='row.recipientUsername',
          :account-name='row.recipientUsername',
          :full-name='recipientName(row.recipientUsername)'
        )
        span.cell-recipient__sub(v-else) {{ row.recipientSubscriberId }}
      template(#cell-type='{ row }')
        span {{ workflowLabel(row.workflowId) }}
      template(#cell-channel='{ row }')
        span {{ channelLabels[row.channel] ?? row.channel }}
      template(#cell-status='{ row }')
        BaseBadge(:variant='statusVariant(row.status)') {{ statusLabels[row.status] ?? row.status }}
      template(#cell-actions='{ row }')
        div(@click.stop)
          BaseButton(
            variant='secondary',
            size='sm',
            :loading='resendingId === row.id',
            @click='onResend(row.id)'
          )
            template(#icon-left)
              q-icon(name='refresh', size='16px')
            | {{ $t('cooperative.notificationJournalWidget.resendLabel') }}

    //- Мобайл: карточки. Поля — по два в ряд (col-xs-6), компактно, без
    //- посимвольного переноса и горизонтального скролла.
    .nj-cards.nj-mobile
      .nj-card(v-for='row in store.items', :key='row.id', @click='openDetails(row.id)')
        .nj-card__head
          .nj-card__recipient
            IdentityCell(
              v-if='row.recipientUsername',
              :account-name='row.recipientUsername',
              :full-name='recipientName(row.recipientUsername)'
            )
            span.nj-card__sub(v-else) {{ row.recipientSubscriberId }}
          BaseBadge(:variant='statusVariant(row.status)') {{ statusLabels[row.status] ?? row.status }}
        .nj-card__grid
          .nj-card__cell
            .nj-card__label {{ $t('cooperative.notificationJournalWidget.column.date') }}
            .nj-card__value {{ formatDateToHumanDateTime(row.createdAt) }}
          .nj-card__cell
            .nj-card__label {{ $t('cooperative.notificationJournalWidget.column.type') }}
            .nj-card__value {{ workflowLabel(row.workflowId) }}
          .nj-card__cell
            .nj-card__label {{ $t('cooperative.notificationJournalWidget.column.channel') }}
            .nj-card__value {{ channelLabels[row.channel] ?? row.channel }}
          .nj-card__cell
            .nj-card__label {{ $t('cooperative.notificationJournalWidget.column.attempts') }}
            .nj-card__value {{ row.attempts }}
        .nj-card__error(v-if='row.lastError') {{ row.lastError }}
        BaseButton.nj-card__action(
          variant='secondary',
          size='sm',
          :loading='resendingId === row.id',
          @click.stop='onResend(row.id)'
        )
          template(#icon-left)
            q-icon(name='refresh', size='16px')
          | {{ $t('cooperative.notificationJournalWidget.resendLabel') }}

    .table-foot
      span {{ rangeLabel }}
      BaseButton(
        v-if='store.hasMore',
        variant='ghost',
        size='sm',
        :loading='store.loading',
        @click='store.loadMore'
      ) {{ $t('cooperative.notificationJournalWidget.loadMoreLabel') }}

  EmptyState(
    v-else,
    :title='$t("cooperative.notificationJournalWidget.emptyTitle")',
    :body='$t("cooperative.notificationJournalWidget.emptyBody")'
  )
    template(#icon)
      q-icon(name='notifications', size='48px')

  //- Правая панель: что получил пайщик — тема и текст уведомления, состояние и попытки.
  DetailsDrawer(v-model='detailsOpen', :title='$t("cooperative.notificationJournalWidget.detailsTitle")', :width='560')
    template(v-if='detail')
      .nj-detail__type {{ workflowLabel(detail.workflowId) }}
      BaseBadge.q-mb-md(:variant='statusVariant(detail.status)') {{ statusLabels[detail.status] ?? detail.status }}
      DataRow(:label='$t("cooperative.notificationJournalWidget.column.recipient")', :value='recipientLabel(detail)', align='vertical')
      DataRow(:label='$t("cooperative.notificationJournalWidget.column.channel")', :value='channelLabels[detail.channel] ?? detail.channel', align='spread')
      DataRow(:label='$t("cooperative.notificationJournalWidget.column.date")', :value='formatDateToHumanDateTime(detail.createdAt)', align='spread')
      DataRow(:label='$t("cooperative.notificationJournalWidget.column.attempts")', :value='detail.attempts', align='spread')
      BaseBanner.q-mt-md(v-if='detail.lastError', variant='neg')
        template(#icon)
          q-icon(name='error_outline')
        | {{ detail.lastError }}
      .nj-detail__section {{ $t('cooperative.notificationJournalWidget.contentTitle') }}
      template(v-if='detail.subject || detail.body')
        .nj-detail__subject {{ detail.subject }}
        //- Текст письма — HTML из шаблона и данных уведомления. Подстановки не
        //- экранируются, поэтому письмо показывается в изолированном фрейме без
        //- скриптов: чужая разметка в данных ничего не выполнит на столе.
        iframe.nj-detail__letter(
          v-if='detail.channel === Zeus.NotificationChannel.EMAIL',
          sandbox='',
          :srcdoc='letterDocument(detail.body ?? "")',
          :title='detail.subject ?? ""'
        )
        .nj-detail__text(v-else) {{ detail.body }}
      .nj-detail__muted(v-else) {{ $t('cooperative.notificationJournalWidget.contentMissing') }}
      template(v-if='detail.deliveries.length')
        .nj-detail__section {{ $t('cooperative.notificationJournalWidget.attemptsTitle') }}
        .nj-detail__attempt(v-for='attempt in detail.deliveries', :key='attempt.id')
          span {{ attempt.attemptNumber }} · {{ formatDateToHumanDateTime(attempt.createdAt) }}
          span.nj-detail__muted(v-if='attempt.error') {{ attempt.error }}
    template(#footer)
      BaseButton(
        v-if='detail',
        variant='secondary',
        size='sm',
        :loading='resendingId === detail.id',
        @click='onResend(detail.id)'
      ) {{ $t('cooperative.notificationJournalWidget.resendLabel') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { Zeus } from '@coopenomics/sdk';
import { Workflows } from '@coopenomics/notifications';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseTable, type BaseTableColumn } from 'src/shared/ui/base/BaseTable';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { IdentityCell } from 'src/shared/ui/domain/IdentityCell';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { DetailsDrawer } from 'src/shared/ui/domain/DetailsDrawer';
import { FilterBar } from 'src/shared/ui/domain/FilterBar';
import type { FilterDefinition, FilterValues } from 'src/shared/ui/domain/FilterBar';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import { getName } from 'src/shared/lib/utils/account';
import { api as accountApi } from 'src/entities/Account/api';
import { useNotificationJournalStore } from '../model';
import type { INotification, INotificationDetail, INotificationsFilter } from '../model';
import { api } from '../api';
import { t } from 'src/shared/i18n';

const store = useNotificationJournalStore();
const resendingId = ref<string | null>(null);

// Резолв ФИО получателя по username (на фронте — DTO журнала несёт только
// username/subscriber_id). Кэш на компонент, чтобы не перезапрашивать.
const recipientNames = ref<Record<string, string>>({});

function recipientName(username?: string | null): string {
  return username ? (recipientNames.value[username] ?? '') : '';
}

async function resolveRecipientNames(): Promise<void> {
  const usernames = [
    ...new Set(
      store.items
        .map((i) => i.recipientUsername)
        .filter((u): u is string => Boolean(u)),
    ),
  ];
  const missing = usernames.filter((u) => !(u in recipientNames.value));
  if (!missing.length) return;
  await Promise.all(
    missing.map(async (username) => {
      let name = '';
      try {
        const account = await accountApi.getAccount(username);
        // getName может вернуть «undefined undefined …» если private_account
        // недоступен/пустой — вычищаем, тогда покажем только username.
        name = account
          ? (getName(account) ?? '').replace(/undefined/g, '').replace(/\s+/g, ' ').trim()
          : '';
      } catch {
        name = '';
      }
      recipientNames.value = { ...recipientNames.value, [username]: name };
    }),
  );
}

watch(() => store.items, () => void resolveRecipientNames(), { immediate: true });

const channelLabels: Record<string, string> = {
  [Zeus.NotificationChannel.EMAIL]: 'Email',
  [Zeus.NotificationChannel.IN_APP]: t('cooperative.notificationJournalWidget.channelInApp'),
  [Zeus.NotificationChannel.PUSH]: 'Push',
};

const statusLabels: Record<string, string> = {
  [Zeus.NotificationOutboxStatus.PENDING]: t('cooperative.notificationJournalWidget.statusPending'),
  [Zeus.NotificationOutboxStatus.SENDING]: t('cooperative.notificationJournalWidget.statusSending'),
  [Zeus.NotificationOutboxStatus.SENT]: t('cooperative.notificationJournalWidget.statusSent'),
  [Zeus.NotificationOutboxStatus.FAILED]: t('cooperative.notificationJournalWidget.statusFailed'),
  [Zeus.NotificationOutboxStatus.CANCELED]: t('cooperative.notificationJournalWidget.statusCanceled'),
};

const statusVariants: Record<string, BaseBadgeVariant> = {
  [Zeus.NotificationOutboxStatus.PENDING]: 'warn',
  [Zeus.NotificationOutboxStatus.SENDING]: 'info',
  [Zeus.NotificationOutboxStatus.SENT]: 'pos',
  [Zeus.NotificationOutboxStatus.FAILED]: 'neg',
  [Zeus.NotificationOutboxStatus.CANCELED]: 'neutral',
};

const statusVariant = (status: string): BaseBadgeVariant => statusVariants[status] ?? 'neutral';

// Человеческое имя типа уведомления из каталога; fallback — сам id.
function workflowLabel(workflowId: string): string {
  const wf = Workflows.workflowsById?.[workflowId];
  return wf?.name ?? workflowId;
}

const filterDefs: FilterDefinition[] = [
  {
    key: 'channel',
    label: t('cooperative.notificationJournalWidget.column.channel'),
    type: 'select',
    options: [
      { label: 'Email', value: Zeus.NotificationChannel.EMAIL },
      { label: t('cooperative.notificationJournalWidget.channelInApp'), value: Zeus.NotificationChannel.IN_APP },
      { label: 'Push', value: Zeus.NotificationChannel.PUSH },
    ],
  },
  {
    key: 'status',
    label: t('cooperative.notificationJournalWidget.column.status'),
    type: 'select',
    options: [
      { label: t('cooperative.notificationJournalWidget.statusPending'), value: Zeus.NotificationOutboxStatus.PENDING },
      { label: t('cooperative.notificationJournalWidget.statusSending'), value: Zeus.NotificationOutboxStatus.SENDING },
      { label: t('cooperative.notificationJournalWidget.statusSent'), value: Zeus.NotificationOutboxStatus.SENT },
      { label: t('cooperative.notificationJournalWidget.statusFailed'), value: Zeus.NotificationOutboxStatus.FAILED },
      { label: t('cooperative.notificationJournalWidget.statusCanceled'), value: Zeus.NotificationOutboxStatus.CANCELED },
    ],
  },
];

const filterValues = computed<FilterValues>(() => ({
  channel: store.filter.channel ?? null,
  status: store.filter.status ?? null,
}));

const columns: BaseTableColumn<INotification>[] = [
  { key: 'date', label: t('cooperative.notificationJournalWidget.column.date'), width: '150px', nowrap: true },
  { key: 'recipient', label: t('cooperative.notificationJournalWidget.column.recipient') },
  { key: 'type', label: t('cooperative.notificationJournalWidget.column.type') },
  { key: 'channel', label: t('cooperative.notificationJournalWidget.column.channel'), width: '140px', nowrap: true },
  { key: 'status', label: t('cooperative.notificationJournalWidget.column.status'), width: '150px', nowrap: true },
  { key: 'attempts', label: t('cooperative.notificationJournalWidget.column.attempts'), width: '90px', numeric: true },
  { key: 'actions', label: t('cooperative.notificationJournalWidget.column.actions'), width: '190px', nowrap: true },
];

// ─── Правая панель уведомления ──────────────────────────────────────────────
const detailsOpen = ref(false);
const detail = ref<INotificationDetail | null>(null);

async function openDetails(id: string): Promise<void> {
  try {
    detail.value = await api.loadNotification(id);
    detailsOpen.value = true;
  } catch (error) {
    FailAlert(error);
  }
}

function recipientLabel(row: INotificationDetail): string {
  const name = recipientName(row.recipientUsername);
  return [name, row.recipientUsername ?? row.recipientSubscriberId].filter(Boolean).join(' · ');
}

/**
 * Документ письма для изолированного фрейма: свои стили документа не
 * наследуют стол, поэтому шрифт и цвета берутся системные, со светлой и
 * тёмной схемой.
 */
function letterDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>:root{color-scheme:light dark}body{margin:12px;font:14px/1.5 system-ui,sans-serif;background:Canvas;color:CanvasText;overflow-wrap:anywhere}</style></head><body>${html}</body></html>`;
}

const rangeLabel = computed(() => {
  const shown = store.items.length;
  return shown ? t('cooperative.notificationJournalWidget.rangeLabel', { shown, totalCount: store.totalCount }) : t('cooperative.notificationJournalWidget.rangeEmptyLabel', { totalCount: store.totalCount });
});

async function onFilterChange(next: FilterValues): Promise<void> {
  try {
    await store.applyFilter({
      channel: (next.channel as INotificationsFilter['channel']) || undefined,
      status: (next.status as INotificationsFilter['status']) || undefined,
    });
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function onResend(id: string): Promise<void> {
  resendingId.value = id;
  try {
    await store.resend(id);
    SuccessAlert(t('cooperative.notificationJournalWidget.resendSuccess'));
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    resendingId.value = null;
  }
}

onMounted(() => {
  void store.load(1).catch((e: unknown) => FailAlert(e));
});

// Журнал живёт по ленте изменений: новое уведомление и смена статуса доставки
// приходят сигналом (таблицы узла notification_outbox и notification_deliveries).
useLiveReload(
  [
    { code: 'core', table: 'notification_outbox' },
    { code: 'core', table: 'notification_deliveries' },
  ],
  () => store.reloadLoaded(),
);
</script>

<style lang="scss" scoped>
.nj-card {
  cursor: pointer;
}

.nj-detail__type {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.nj-detail__section {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin: var(--p-5) 0 var(--p-2);
}

.nj-detail__subject {
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.nj-detail__letter {
  width: 100%;
  min-height: calc(var(--p-10) * 5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.nj-detail__text {
  white-space: pre-wrap;
  color: var(--p-ink);
}

.nj-detail__attempt {
  display: flex;
  flex-direction: column;
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
}

.nj-detail__muted {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.notification-journal {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.table-scroll {
  overflow-x: auto;
}

/* 7 колонок с кнопкой «Переотправить» не влезают в телефон осмысленно —
   таблица скроллится по горизонтали (.table-scroll). Глобальный канон форсит
   .table{min-width:0!important}+table-layout:auto, схлопывая колонки в буквы-
   в-столбик; перебиваем !important+специфичностью scope, чтобы вернуть скролл. */
.table {
  table-layout: fixed !important;
  min-width: 960px !important;
}

.col-date {
  width: 148px;
  white-space: nowrap;
}
.col-num {
  width: 88px;
  text-align: center;
}
.col-action {
  width: 180px;
  text-align: right;
}

.cell-recipient {
  overflow-wrap: break-word;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.cell-recipient__sub {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-2);
}
.cell-status--has-error {
  cursor: help;
}

/* ── Десктоп таблица vs мобайл карточки ────────────────────────────────
   .nj-cards задаёт display:flex; чтобы скрытие на десктопе не перебивалось
   по порядку источника (как было в реестре платежей), вешаем display на
   двойной селектор .nj-cards.nj-mobile (выше специфичность). */
.nj-cards.nj-mobile {
  display: none;
}
@media (max-width: 599px) {
  .nj-desktop {
    display: none;
  }
  .nj-cards.nj-mobile {
    display: flex;
  }
}

.nj-cards {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.nj-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
}
.nj-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-3, 12px);
}
.nj-card__recipient {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}
.nj-card__sub {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-2);
  overflow-wrap: break-word;
}
/* Поля по два в ряд (эквивалент col-xs-6), компактно. */
.nj-card__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-2, 8px) var(--p-4, 16px);
}
.nj-card__cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.nj-card__label {
  font-size: var(--p-fs-eyebrow, 11px);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.nj-card__value {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink);
  overflow-wrap: break-word;
}
.nj-card__error {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-neg);
  overflow-wrap: break-word;
}
.nj-card__action {
  align-self: flex-start;
}
</style>
