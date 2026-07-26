<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import { BaseButton, BaseSelect, BaseBadge, CardListSkeleton, type BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { listMyReturnClaims, type MarketplaceReturnClaimView } from '../api';
import { fetchMyOrders } from '../../MyOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import SubmitReturnClaimDialog from './SubmitReturnClaimDialog.vue';
import ReturnClaimDetailsDialog from './ReturnClaimDetailsDialog.vue';

/**
 * Story 7.1 — orderer-стол: список заявлений пайщика на гарантийный возврат
 * имущества. Карточки делятся на «активные» (PENDING_CHAIRMAN_REVIEW,
 * APPROVED_FOR_VISIT) и «архив» (REJECTED_REMOTELY, REJECTED_AT_VISIT,
 * ACCEPTED_AT_VISIT). Страница на MONO Platform v2: статусы — `BaseBadge`,
 * подача — `BaseSelect` + `BaseButton`.
 *
 * Подача нового заявления (с фото-доказательством) идёт через
 * SubmitReturnClaimDialog (full-screen TakeoverDialog с пошаговым
 * wizard'ом, использует канонические виджеты).
 */

const items = ref<MarketplaceReturnClaimView[]>([]);
const loading = ref(false);

const selectedOrderId = ref<string | null>(null);
const eligibleOrders = ref<MarketplaceOrderView[]>([]);
const eligibleLoading = ref(false);
const submitDialog = ref(false);
const detailsDialog = ref(false);
const selectedClaim = ref<MarketplaceReturnClaimView | null>(null);

// Не предлагаем заказы, по которым уже открыта заявка: backend всё равно
// отклонит повторную (ConflictException), а пайщику бессмысленно её начинать.
const orderOptions = computed(() => {
  const openOrderIds = new Set(
    items.value
      .filter(
        (c) =>
          c.status === Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW ||
          c.status === Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT,
      )
      .map((c) => c.order_id),
  );
  return eligibleOrders.value
    .filter((o) => !openOrderIds.has(o.id))
    .map((o) => {
      const saleUnit = marketplaceOrderSaleUnit(o.quantity, o.unit_of_measure, o.package_size);
      return {
        value: o.id,
        // total_cost_with_fee — как в «Мои заказы»: заказчику показываем сумму,
        // которую он реально заплатил (с членским взносом), не себестоимость.
        label: `Заказ ${o.id.slice(0, 8)} · ${saleUnit.units}×${saleUnit.unitLabel} · ${Number(o.total_cost_with_fee).toLocaleString('ru-RU')} ₽`,
      };
    });
});

const activeClaims = computed(() =>
  items.value.filter(
    (c) =>
      c.status === Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW ||
      c.status === Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT,
  ),
);
const archiveClaims = computed(() =>
  items.value.filter(
    (c) =>
      c.status === Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT ||
      c.status === Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY ||
      c.status === Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT,
  ),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyReturnClaims();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заявления на возврат');
  } finally {
    loading.value = false;
  }
}

async function loadEligibleOrders(): Promise<void> {
  eligibleLoading.value = true;
  try {
    const result = await fetchMyOrders({ statuses: ['RECEIVED'], limit: 100 });
    eligibleOrders.value = result.items;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить полученные заказы');
  } finally {
    eligibleLoading.value = false;
  }
}

function onSelectOrder(value: string | number | null): void {
  selectedOrderId.value = value == null ? null : String(value);
}

function openSubmit(): void {
  if (!selectedOrderId.value) {
    FailAlert(new Error('Выберите полученный заказ.'));
    return;
  }
  submitDialog.value = true;
}

function openDetails(claim: MarketplaceReturnClaimView): void {
  selectedClaim.value = claim;
  detailsDialog.value = true;
}

function onSubmitted(): void {
  selectedOrderId.value = null;
  void load();
  void loadEligibleOrders();
}

function claimQuantityLabel(c: MarketplaceReturnClaimView): string {
  const saleUnit = marketplaceOrderSaleUnit(c.actual_quantity, c.unit_of_measure, c.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function humanStatus(status: MarketplaceReturnClaimView['status']): string {
  switch (status) {
    case Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW:
      return 'На рассмотрении председателя';
    case Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT:
      return 'Очный визит одобрен';
    case Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT:
      return 'Возврат принят';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY:
      return 'Отказано удалённо';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT:
      return 'Отказано на месте';
    default:
      return status;
  }
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('ru-RU');
}

function statusVariant(status: MarketplaceReturnClaimView['status']): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW:
      return 'info';
    case Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT:
      return 'warn';
    case Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT:
      return 'pos';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY:
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT:
      return 'neg';
    default:
      return 'neutral';
  }
}

// Realtime: председатель решает по заявлению (в т.ч. пока пайщик стоит у
// стойки на очном осмотре) — вердикт появляется в списке сразу. Персональный
// канал несёт только свои заявления, фильтр не нужен.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceReturnClaimStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() },
);

onMounted(async () => {
  // Сначала заявки, потом заказы: orderOptions исключает заказы с открытой
  // заявкой, и без этого порядка возникает окно, когда select показывает
  // заказ, по которому возврат уже начат (backend всё равно отклонит).
  await load();
  await loadEligibleOrders();
});
</script>

<template lang="pug">
q-page.returns(role="region", aria-label="Гарантийный возврат")
  PageHint(storage-key="mp:orderer-returns:banner-dismissed")
    | Подача заявления возможна только по выданному заказу в пределах гарантийного срока, заданного поставщиком.

  .returns__submit
    BaseSelect.returns__select(
      :model-value="selectedOrderId",
      :options="orderOptions",
      label="Полученный заказ",
      :hint="orderOptions.length === 0 ? 'Нет полученных заказов, доступных для возврата' : 'Выберите заказ, по которому оформляете возврат'",
      @update:model-value="onSelectOrder"
    )
    BaseButton(
      variant="primary",
      :disabled="!selectedOrderId",
      @click="openSubmit"
    )
      template(#icon-left)
        q-icon(name="assignment", size="18px")
      | Подать заявление

  //- Канон загрузки: скелетон вместо мелькающих заглушек «пусто» на первичной загрузке.
  CardListSkeleton(v-if="loading && !activeClaims.length && !archiveClaims.length", :count="2")

  section.returns__section
    .t-h3 Активные заявления
    .returns__empty(v-if="activeClaims.length === 0 && !loading") Нет активных заявлений на возврат.
    q-list(v-if="activeClaims.length > 0", bordered, separator)
      q-item(v-for="c in activeClaims", :key="c.id", clickable, @click="openDetails(c)")
        q-item-section
          q-item-label.text-weight-medium {{ claimQuantityLabel(c) }} · {{ c.fact_cost }} ₽
          q-item-label(caption) Заказ {{ c.order_id.slice(0, 8) }} · подано {{ formatDate(c.created_at) }}
          q-item-label(caption) {{ c.reason_text.slice(0, 120) }}{{ c.reason_text.length > 120 ? '…' : '' }}
        q-item-section(side)
          BaseBadge(:variant="statusVariant(c.status)") {{ humanStatus(c.status) }}

  section.returns__section
    .t-h3 Архив заявлений
    .returns__empty(v-if="archiveClaims.length === 0 && !loading") Архив пуст.
    q-list(v-if="archiveClaims.length > 0", bordered, separator)
      q-item(v-for="c in archiveClaims", :key="c.id", clickable, @click="openDetails(c)")
        q-item-section
          q-item-label {{ claimQuantityLabel(c) }} · {{ c.fact_cost }} ₽
          q-item-label(caption) Заказ {{ c.order_id.slice(0, 8) }}
          q-item-label.returns__restored(v-if="c.ledger_snapshot", caption) Восстановлено на программный кошелёк: {{ c.ledger_snapshot.amount }} ₽
        q-item-section(side)
          BaseBadge(:variant="statusVariant(c.status)") {{ humanStatus(c.status) }}

  SubmitReturnClaimDialog(
    v-model="submitDialog",
    :order-id="selectedOrderId ?? ''",
    @submitted="onSubmitted"
  )

  ReturnClaimDetailsDialog(
    v-model="detailsDialog",
    :claim="selectedClaim"
  )
</template>

<style scoped lang="scss">
.returns {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__submit {
    display: flex;
    gap: var(--p-3, 12px);
    align-items: flex-start;
    flex-wrap: wrap;
    padding: var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
  }

  &__select {
    flex: 1 1 320px;
    min-width: 240px;
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__empty {
    padding: var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__restored {
    color: var(--p-pos) !important;
  }
}

@media (max-width: 768px) {
  .returns {
    padding: var(--p-4, 16px);
  }
}
</style>
