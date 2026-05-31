<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { listAplReceptionsByBraname } from '../../OperatorReception/api';
import { listIssuancesByBraname } from '../../OperatorIssuance/api';
import { listReturnClaimsByBraname } from '../../OperatorReturnClaims/api';
import type { MarketplaceAplReceptionView } from '../../OffererPendingAplReceptions/api';
import type { MarketplaceOrderIssuanceView } from '../../OperatorIssuance/api';
import type { MarketplaceReturnClaimView } from '../../OperatorReturnClaims/api';

/**
 * Эпик 6 / Story 6.x: «Сводный стол КУ» председателя кооперативного участка.
 *
 * Объединяет три существующих ленты по braname в один экран с табами:
 *   - Приёмки партий (ListAplReceptionsByBraname, Эпик 5)
 *   - Выдачи заказов (ListIssuancesByBraname, Эпик 6)
 *   - Гарантийные возвраты (ListReturnClaimsByBraname, Эпик 7)
 *
 * Действия (открыть акт приёмки, выдачу, решение по возврату) выполняются
 * на соответствующих специализированных страницах /market-pvz/reception,
 * /issuance, /returns — здесь только сводный read-обзор для председателя КУ.
 *
 * Активный КУ берётся из общего контекста оператора (entities/OperatorBranch);
 * служебные коды участков в UI не показываются.
 */

const POLL_INTERVAL_MS = 20_000;

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute();
const store = useOperatorBranchStore();
const coopname = computed(() => String(route.params.coopname ?? ''));
const braname = computed(() => store.activeBraname ?? '');
const activeTab = ref<'receptions' | 'issuances' | 'returns'>('receptions');

const receptions = ref<MarketplaceAplReceptionView[]>([]);
const issuances = ref<MarketplaceOrderIssuanceView[]>([]);
const returns = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const totals = computed(() => ({
  receptions: receptions.value.length,
  issuances: issuances.value.length,
  returns: returns.value.length,
}));

const hasBranch = computed(() => braname.value.trim().length > 0);

const STATUS_LABEL: Record<string, string> = {
  // приёмка партии
  PENDING_SUPPLIER_SIGN: 'Ждёт подписи поставщика',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'Ждёт подписи председателя',
  // заказ / выдача
  ACTIVE: 'Ждёт цикла / решения',
  ACCEPTED_PENDING_SUPPLIER: 'Ждёт поставщика',
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 'Ждёт поставщика',
  ACCEPTED: 'Принят поставщиком',
  SUPPLY_PREPARED: 'Поставка готовится',
  ACCEPTED_TO_COOP: 'Принят кооперативом',
  READY_TO_RECEIVE: 'Готов к выдаче',
  RECEIVED: 'Получен',
  RETURNED: 'Возвращён',
  CANCELLED: 'Отменён',
  CANCELLED_BY_ORDERER: 'Отменён заказчиком',
  CANCELLED_BY_SUPPLIER: 'Отменён поставщиком',
  // гарантийный возврат
  PENDING_CHAIRMAN_REVIEW: 'Ждёт удалённого рассмотрения',
  APPROVED_FOR_VISIT: 'Очный визит одобрен',
  ACCEPTED_AT_VISIT: 'Возврат принят',
  REJECTED_REMOTELY: 'Отказано удалённо',
  REJECTED_AT_VISIT: 'Отказано на месте',
};
function statusLabel(v?: string | null): string {
  return v ? (STATUS_LABEL[v] ?? v) : '—';
}

async function loadAll(): Promise<void> {
  const name = braname.value.trim();
  if (!name) return;
  loading.value = true;
  try {
    const [r, i, ret] = await Promise.all([
      listAplReceptionsByBraname({ braname: name }),
      listIssuancesByBraname({ delivery_braname: name }),
      listReturnClaimsByBraname({ delivery_braname: name }),
    ]);
    receptions.value = r;
    issuances.value = i;
    returns.value = ret;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

watch(braname, () => {
  receptions.value = [];
  issuances.value = [];
  returns.value = [];
  void loadAll();
});

onMounted(async () => {
  await store.ensureLoaded(coopname.value);
  void loadAll();
  pollTimer = setInterval(() => {
    if (hasBranch.value) void loadAll();
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('ru-RU');
}
</script>

<template lang="pug">
q-page.orders(role='region', aria-label='Сводный стол участка')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Сводный стол доступен председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:branch-orders:banner-dismissed')
      | Все процессы вашего пункта выдачи в одном месте: приёмки партий, выдачи пайщикам,
      | гарантийные возвраты. Для действий переходите на специализированные столы.

    .orders__toolbar
      q-space
      BaseButton(variant='ghost', :loading='loading', @click='loadAll')
        template(#icon-left)
          q-icon(name='refresh', size='18px')
        | Обновить

    .orders__card
      q-tabs(
        v-model='activeTab',
        inline-label,
        align='left',
        no-caps,
        dense,
        indicator-color='primary',
        active-color='primary'
      )
        q-tab(name='receptions', icon='local_shipping')
          | Приёмки
          q-badge.q-ml-sm(color='primary', :label='String(totals.receptions)')
        q-tab(name='issuances', icon='handshake')
          | Выдачи
          q-badge.q-ml-sm(color='primary', :label='String(totals.issuances)')
        q-tab(name='returns', icon='assignment_return')
          | Возвраты
          q-badge.q-ml-sm(color='primary', :label='String(totals.returns)')

      q-separator

      q-tab-panels(v-model='activeTab', animated)
        q-tab-panel(name='receptions')
          EmptyState(
            v-if='!loading && receptions.length === 0',
            title='Нет активных приёмок',
            body='Подтверждённые поставщиком партии появятся здесь.'
          )
            template(#icon)
              q-icon(name='inbox', size='48px')
          q-list(v-else, separator)
            q-item(v-for='r in receptions', :key='r.id')
              q-item-section
                q-item-label № {{ r.id.slice(0, 8) }} — партия {{ r.shipment_id?.slice?.(0, 8) ?? '—' }}
                q-item-label(caption) Создана: {{ formatDate(r.created_at) }} / Статус: {{ statusLabel(r.status) }}

        q-tab-panel(name='issuances')
          EmptyState(
            v-if='!loading && issuances.length === 0',
            title='Нет заказов на выдачу',
            body='Заказы, принятые кооперативом и готовые к выдаче, появятся здесь после маркировки на участке.'
          )
            template(#icon)
              q-icon(name='inventory', size='48px')
          q-list(v-else, separator)
            q-item(v-for='o in issuances', :key='o.id')
              q-item-section
                q-item-label № {{ o.id.slice(0, 8) }} — {{ o.orderer_account }}
                q-item-label(caption)
                  | Кол-во: {{ o.quantity }} ед. / Статус: {{ statusLabel(o.status) }} / Создан: {{ formatDate(o.created_at) }}

        q-tab-panel(name='returns')
          EmptyState(
            v-if='!loading && returns.length === 0',
            title='Нет заявлений на возврат',
            body='Заявления пайщиков в гарантийный период появятся здесь.'
          )
            template(#icon)
              q-icon(name='assignment_return', size='48px')
          q-list(v-else, separator)
            q-item(v-for='c in returns', :key='c.id')
              q-item-section
                q-item-label № {{ c.id.slice(0, 8) }} — {{ c.orderer_account }}
                q-item-label(caption) Статус: {{ statusLabel(c.status) }} / Создано: {{ formatDate(c.created_at) }}
</template>

<style scoped lang="scss">
.orders {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__card {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    overflow: hidden;
  }
}

@media (max-width: 768px) {
  .orders {
    padding: var(--p-4, 16px);
  }
}
</style>
