<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseSelect, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant, BaseSelectOption } from 'src/shared/ui/base';
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
import { formatAsset2Digits } from 'src/shared/lib/utils';
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
  // Живой роут раздела «Реквизиты» — `payment-methods` из расширения
  // participant (одноимённый `user-payment-methods` в src/desktops/* — мёртвый
  // legacy-манифест, его нет в раутере).
  void router.push({ name: 'payment-methods', params: { coopname: info.coopname } });
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
  //- Карточки, не таблица: на узких экранах таблица уезжала в горизонтальный
  //- скролл и дёргалась — карточки мотаются просто вниз.
  CardListSkeleton(v-if='loading && !items.length', :count='4')
  .payout-list(v-else-if='items.length')
    BaseCard(v-for='row in items', :key='row.id')
      .payout-card
        .payout-card__top
          .payout-card__amount {{ formatAsset2Digits(`${row.amount} ${row.symbol}`) }}
          BaseBadge(:variant='statusOf(row.status).variant') {{ statusOf(row.status).label }}
        .payout-card__date {{ formatDateToHumanDateTime(row.created_at) }}
        .payout-card__row(v-if='row.payout_destination')
          q-icon(name='account_balance', size='14px')
          span {{ row.payout_destination }}
        .payout-card__purpose(v-if='row.purpose') {{ row.purpose }}
        .payout-card__decline(v-if='row.decline_reason') Причина отказа: {{ row.decline_reason }}

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

.payout-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.payout-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.payout-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
}
.payout-card__amount {
  font-size: var(--p-fs-h3, 18px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.payout-card__date {
  color: var(--p-ink-3);
  font-size: var(--p-fs-sm, 13px);
}
.payout-card__row {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink-2);
}
.payout-card__purpose {
  color: var(--p-ink-2);
  overflow-wrap: anywhere;
}
.payout-card__decline {
  color: var(--p-neg);
}

@media (max-width: 768px) {
  .offerer-payments {
    padding: var(--p-4, 16px);
  }
}
</style>
