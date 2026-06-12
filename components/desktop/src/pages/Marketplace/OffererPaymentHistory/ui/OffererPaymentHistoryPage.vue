<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, BaseSelectOption, TableSkeletonColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import type { IBankTransferData, ISBPData } from 'src/entities/Wallet/model/types';
import {
  loadSupplierPaymentSettings,
  setSupplierPayoutMethod,
  type MarketplaceSupplierPaymentSettingsView,
} from 'src/entities/MarketplaceSupplierSettings';
import { formatDateToHumanDateTime } from 'src/shared/lib/utils/dates/formatDateToHumanDateTime';
import { listMyPayments, type MarketplaceOutgoingPaymentRequestView } from '../api';

/**
 * Стол поставщика «Выплаты»: настройка «выплаты получаю на…» + история выплат.
 *
 * Реквизиты — платёжные методы ядра (раздел «Реквизиты» стола пайщика);
 * здесь поставщик выбирает, на какой из них уходят выплаты по актам приёмки.
 * Выбор глобальный (не per-карточка): смена счёта — одно действие. Без
 * реквизитов публикация предложений закрыта backend-гейтом, поэтому страница
 * подсказывает добавить их сразу.
 */

const router = useRouter();
const { info } = useSystemStore();
const session = useSessionStore();
const wallet = useWalletStore();

// ── настройка «выплаты получаю на…» ──
const settings = ref<MarketplaceSupplierPaymentSettingsView | null>(null);
const settingsLoading = ref(false);
const savingMethod = ref(false);

function methodLabel(method: { method_type: string; data: unknown }): string {
  if (method.method_type === 'sbp') {
    const phone = (method.data as ISBPData).phone ?? '';
    return phone ? `СБП ${phone}` : 'СБП';
  }
  const bank = method.data as IBankTransferData;
  const tail = (bank.account_number ?? '').slice(-4);
  const name = bank.bank_name?.trim() || 'Банковский счёт';
  return tail ? `${name} •${tail}` : name;
}

const methodOptions = computed<BaseSelectOption[]>(() =>
  (wallet.methods ?? []).map((m) => ({ value: m.method_id, label: methodLabel(m) })),
);

const hasMethods = computed(() => methodOptions.value.length > 0);

// Выбранное значение селектора: явный выбор поставщика; если выбора не было —
// показываем пусто, а действующий фолбэк (метод по умолчанию) описывает hint.
const selectedMethodId = computed(() => settings.value?.payout_method_id ?? null);

const selectHint = computed(() => {
  if (!settings.value) return undefined;
  if (!settings.value.payout_method_id && settings.value.has_payout_method) {
    return `Используются реквизиты по умолчанию: ${settings.value.payout_destination ?? ''}`;
  }
  return undefined;
});

async function loadSettings(): Promise<void> {
  settingsLoading.value = true;
  try {
    settings.value = await loadSupplierPaymentSettings();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить настройки выплат');
  } finally {
    settingsLoading.value = false;
  }
}

async function onPickMethod(method_id: string | number | null): Promise<void> {
  if (!method_id || savingMethod.value) return;
  savingMethod.value = true;
  try {
    settings.value = await setSupplierPayoutMethod(String(method_id));
    SuccessAlert('Реквизиты для выплат сохранены');
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить реквизиты для выплат');
  } finally {
    savingMethod.value = false;
  }
}

function goToRequisites(): void {
  void router.push({ name: 'user-payment-methods', params: { coopname: info.coopname } });
}

// ── история выплат ──
const items = ref<MarketplaceOutgoingPaymentRequestView[]>([]);
const loading = ref(false);

// Статус выплаты (PENDING/COMPLETED/DECLINED) → метка + canon-вариант бейджа.
const PAYMENT_STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  PENDING: { label: 'Ожидает оплаты', variant: 'warn' },
  COMPLETED: { label: 'Оплачена', variant: 'pos' },
  DECLINED: { label: 'Отклонена', variant: 'neg' },
};

function statusOf(v?: string | null): { label: string; variant: BaseBadgeVariant } {
  if (!v) return { label: '—', variant: 'neutral' };
  return PAYMENT_STATUS[v] ?? PAYMENT_STATUS[v.toUpperCase()] ?? { label: v, variant: 'neutral' };
}

// Колонки скелетона повторяют шапку реальной таблицы — каркас не дёргается.
const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Дата', cell: 'text', cellWidth: '120px' },
  { label: 'Сумма', class: 'col-num', cell: 'text', cellWidth: '80px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Куда', cell: 'text' },
  { label: 'Назначение', cell: 'text' },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyPayments();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить историю выплат');
  } finally {
    loading.value = false;
  }
}

// Realtime: кассир подтвердил/отклонил перевод — строка истории меняет статус
// сразу. Новая PENDING-выплата рождается закрывающей подписью председателя,
// её приносит сигнал статуса акта приёмки (он тоже адресован поставщику).
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplacePaymentStatusChangedEvent: () => reloadLive(),
    MarketplaceAplReceptionStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
);

onMounted(() => {
  void load();
  void loadSettings();
  void wallet.loadUserWallet({ coopname: info.coopname, username: session.username });
});
</script>

<template lang="pug">
q-page.offerer-payments
  PageHint(storage-key='mp:offerer-payments:banner-dismissed')
    | Выплаты по вашим актам приёмки. Совет авторизует выплату, после чего
    | она уходит в банк — статус обновляется здесь по мере обработки.

  //- ───────── Куда получаю выплаты ─────────
  BaseCard(title='Выплаты получаю на')
    template(#actions)
      BaseButton(variant='ghost', size='sm', @click='goToRequisites')
        q-icon(name='add_card', size='16px')
        span.q-ml-sm Добавить реквизиты

    .payout-method(v-if='hasMethods')
      BaseSelect.payout-method__select(
        :model-value='selectedMethodId',
        :options='methodOptions',
        label='Реквизиты для выплат',
        placeholder='Выберите реквизиты',
        :hint='selectHint',
        :disabled='savingMethod || settingsLoading',
        @update:model-value='onPickMethod'
      )

    .banner.banner--warn(v-else)
      q-icon.banner__icon(name='warning_amber', size='18px')
      .banner__body
        | У вас нет сохранённых реквизитов. Добавьте банковский счёт или СБП
        | в разделе «Реквизиты» — без них публикация предложений недоступна.

  //- ───────── История выплат ─────────
  TableSkeleton(
    v-if='loading && !items.length',
    :columns='skeletonColumns',
    :rows='6',
    min-width='860px'
  )
  .table-wrap(v-else-if='items.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-date Дата
            th.col-num Сумма
            th.col-status Статус
            th Куда
            th Назначение
        tbody
          tr(v-for='row in items', :key='row.id')
            td.col-date {{ formatDateToHumanDateTime(row.created_at) }}
            td.col-num {{ row.amount }} {{ row.symbol }}
            td.col-status
              BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
            td {{ row.payout_destination || '—' }}
            td.cell-purpose {{ row.purpose || '—' }}

  EmptyState(
    v-else,
    title='Выплат пока нет',
    body='Здесь появятся выплаты по вашим актам приёмки, когда совет их авторизует.'
  )
    template(#icon)
      q-icon(name='payments', size='48px')
</template>

<style scoped lang="scss">
.offerer-payments {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.payout-method__select {
  max-width: 420px;
}

.table-scroll {
  overflow-x: auto;
}
.table {
  min-width: 860px;
}
.col-date {
  width: 150px;
  white-space: nowrap;
}
.col-num {
  width: 130px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.col-status {
  width: 170px;
}
.cell-purpose {
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .offerer-payments {
    padding: var(--p-4, 16px);
  }
}
</style>
