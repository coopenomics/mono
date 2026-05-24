<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Notify } from 'quasar';
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
 * Поле braname — пока ручной ввод; в Story 6.x+1 подключится auto-detect
 * из marketplace_whoami / marketplace_member_wallet (председатель привязан
 * к одному КУ через trustee).
 */

const POLL_INTERVAL_MS = 20_000;

const braname = ref<string>('');
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
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'Ждёт подписи председателя КУ',
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
      listAplReceptionsByBraname(name),
      listIssuancesByBraname(name),
      listReturnClaimsByBraname({ delivery_braname: name }),
    ]);
    receptions.value = r;
    issuances.value = i;
    returns.value = ret;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

watch(braname, () => {
  receptions.value = [];
  issuances.value = [];
  returns.value = [];
});

onMounted(() => {
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
q-page.mp-role-operator.mp-branch-orders(role="region", aria-label="Сводный стол КУ")
  div.mp-branch-orders__header
    div
      div.text-h5 Сводный стол кооперативного участка
      div.text-caption.mp-branch-orders__subtitle
        | Все процессы вашего КУ в одном месте: приёмки партий, выдачи пайщикам, гарантийные возвраты. Для действий — переходите на специализированные столы Стола ПВЗ.

  q-card(flat, bordered)
    q-card-section
      div.row.q-col-gutter-md.items-end
        div.col-12.col-md-8
          q-input(
            v-model="braname",
            outlined,
            dense,
            clearable,
            label="ID кооперативного участка (braname)",
            hint="Введите код вашего КУ — например voskhod-kpvz",
            @keyup.enter="loadAll"
          )
            template(#prepend)
              q-icon(name="fa-solid fa-warehouse")
        div.col-12.col-md-4
          q-btn(
            unelevated,
            no-caps,
            color="primary",
            icon="fa-solid fa-magnifying-glass",
            label="Загрузить",
            :loading="loading",
            :disable="!hasBranch",
            @click="loadAll"
          )

  q-card(v-if="hasBranch", flat, bordered)
    q-tabs(
      v-model="activeTab",
      inline-label,
      align="left",
      no-caps,
      dense,
      indicator-color="primary",
      active-color="primary"
    )
      q-tab(name="receptions", icon="fa-solid fa-truck-ramp-box")
        | Приёмки
        q-badge.q-ml-sm(color="primary", :label="String(totals.receptions)")
      q-tab(name="issuances", icon="fa-solid fa-handshake")
        | Выдачи
        q-badge.q-ml-sm(color="primary", :label="String(totals.issuances)")
      q-tab(name="returns", icon="fa-solid fa-clipboard-check")
        | Возвраты
        q-badge.q-ml-sm(color="primary", :label="String(totals.returns)")

    q-separator

    q-tab-panels(v-model="activeTab", animated)
      q-tab-panel(name="receptions")
        div.mp-branch-orders__empty(v-if="!loading && receptions.length === 0")
          q-icon(name="fa-solid fa-box-open", size="40px", color="grey-5")
          div.text-subtitle1.q-mt-sm Нет активных приёмок
          div.text-caption Подтверждённые поставщиком партии появятся здесь.
        q-list(v-else, separator)
          q-item(v-for="r in receptions", :key="r.id")
            q-item-section
              q-item-label № {{ r.id.slice(0, 8) }} — партия {{ r.shipment_id?.slice?.(0, 8) ?? '—' }}
              q-item-label(caption) Создана: {{ formatDate(r.created_at) }} / Статус: {{ statusLabel(r.status) }}

      q-tab-panel(name="issuances")
        div.mp-branch-orders__empty(v-if="!loading && issuances.length === 0")
          q-icon(name="fa-solid fa-people-carry-box", size="40px", color="grey-5")
          div.text-subtitle1.q-mt-sm Нет заказов на выдачу
          div.text-caption Заказы, принятые кооперативом и готовые к выдаче, появятся здесь после маркировки на ПВЗ.
        q-list(v-else, separator)
          q-item(v-for="o in issuances", :key="o.id")
            q-item-section
              q-item-label № {{ o.id.slice(0, 8) }} — {{ o.orderer_account }}
              q-item-label(caption)
                | Кол-во: {{ o.quantity }} ед. / Статус: {{ statusLabel(o.status) }} / Создан: {{ formatDate(o.created_at) }}

      q-tab-panel(name="returns")
        div.mp-branch-orders__empty(v-if="!loading && returns.length === 0")
          q-icon(name="fa-solid fa-clipboard-check", size="40px", color="grey-5")
          div.text-subtitle1.q-mt-sm Нет заявлений на возврат
          div.text-caption Заявления пайщиков в гарантийный период появятся здесь.
        q-list(v-else, separator)
          q-item(v-for="c in returns", :key="c.id")
            q-item-section
              q-item-label № {{ c.id.slice(0, 8) }} — {{ c.orderer_account }}
              q-item-label(caption) Статус: {{ statusLabel(c.status) }} / Создано: {{ formatDate(c.created_at) }}

  div.mp-branch-orders__hint(v-if="!hasBranch")
    q-icon(name="fa-solid fa-circle-info", color="primary")
    | Введите ID вашего КУ, чтобы увидеть сводку процессов.
</template>

<style scoped lang="scss">
.mp-branch-orders {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--mp-space-md);
  }

  &__subtitle {
    color: var(--mp-on-surface-muted);
    max-width: 720px;
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mp-space-lg) 0;
    color: var(--mp-on-surface-muted);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: var(--mp-space-xs);
    color: var(--mp-on-surface-muted);
    padding: var(--mp-space-md) 0;
  }
}
</style>
