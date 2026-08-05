<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BaseButton, BaseCard, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { type ReceptionGroup, getMembershipFeePercent, applyMembershipFee } from 'src/shared/lib/marketplace';
import { marketplaceOrderSaleUnit, marketplaceQuantityLabel } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import type { MarketplaceAplReceptionView } from 'src/pages/Marketplace/OffererPendingAplReceptions/api';
import { useOnsiteSignatureGate } from '../model/useOnsiteSignatureGate';

/**
 * Глобальный оверлей подписи на месте — монтируется один раз в App.vue рядом с
 * прочими app-level гейтами (RequireAgreements, SelectBranchOverlay). Сам опрос
 * и логика — в useOnsiteSignatureGate; здесь только persistent-окно и вёрстка.
 *
 * Persistent-режим (no-backdrop / no-escape / no-close): пайщик не может
 * «увести» окно — закрывает его только сама подпись (статус ушёл вперёд) либо
 * отмена (поставщик / оператор откатили черновик приёмки; пайщик отказался
 * от бандла выдачи). Это легитимное исключение из правила «не перекрывать
 * экран»: осознанный consent-gate, как онбординг-оферты.
 */

const {
  isVisible,
  signingKey,
  supplierTasks,
  proposalTasks,
  refresh,
  signSupplier,
  cancelSupplier,
  signProposal,
  declineProposal,
} = useOnsiteSignatureGate();

const systemStore = useSystemStore();
const kuStore = useMarketplaceKUDetailsStore();

// Человекочитаемое имя КУ + адрес для поставщика (у заказа адрес пункта уже есть
// в самих данных). Реквизиты КУ грузим лениво — только когда впервые появляется
// очная поставка и стор ещё пуст; не дёргаем на каждом тике.
let kuLoaded = false;
function ensureKuDetails(): void {
  if (kuLoaded || !supplierTasks.value.length) return;
  kuLoaded = true;
  void kuStore
    .load({ coopname: systemStore.info.coopname, onlyActive: false })
    .catch(() => undefined);
}
watch(supplierTasks, ensureKuDetails, { immediate: false });

function kuName(braname: string): string {
  return kuStore.details.find((d) => d.coreBraname === braname)?.name || braname;
}
function kuAddr(braname: string): string {
  return kuStore.details.find((d) => d.coreBraname === braname)?.addressFull ?? '';
}

function proposalLineCost(i: { quantity: number; unit_price: string }): string {
  return (i.quantity * Number.parseFloat(i.unit_price)).toFixed(4);
}

// Себестоимость акта (p.total_cost) — без членского взноса; пайщик платит
// взнос сверх неё (requirement b6, та же формула, что в каталоге/корзине).
// Раньше на этом экране взнос не был виден вовсе — жалоба 2026-08-02.
const feePercent = ref(0);
function proposalFeeAmount(p: { total_cost: string }): string {
  return (applyMembershipFee(Number(p.total_cost), feePercent.value) - Number(p.total_cost)).toFixed(4);
}
function proposalTotalWithFee(p: { total_cost: string }): string {
  return applyMembershipFee(Number(p.total_cost), feePercent.value).toFixed(4);
}

function receptionLineQuantity(l: { quantity: number; unit: string; packageSize: number | null }): string {
  const saleUnit = marketplaceOrderSaleUnit(l.quantity, l.unit, l.packageSize);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function proposalItemQuantity(i: { quantity: number; unit_of_measure: string | null }): string {
  return marketplaceQuantityLabel(i.quantity, i.unit_of_measure);
}

const supplierBusy = (g: ReceptionGroup<MarketplaceAplReceptionView>) => signingKey.value === g.key;
const proposalBusy = (id: string) => signingKey.value === id;
const anySigning = computed(() => signingKey.value !== null);

// Первичная загрузка состояния при монтировании оверлея (он живёт всё время
// работы приложения). Дальше гейт обновляется realtime-подпиской + catch-up'ом
// канала ядра — поллинга больше нет (Фаза 2).
onMounted(() => {
  void refresh();
  getMembershipFeePercent()
    .then((p) => (feePercent.value = p))
    .catch(() => undefined); // нет ставки — сумму покажем без взноса
});
</script>

<template lang="pug">
BaseDialog(
  :model-value='isVisible',
  title='Подпишите документ',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  .onsite-gate
    p.onsite-gate__lead
      | Чтобы завершить операцию на пункте, подтвердите документ своей подписью.
      | Окно закроется само, как только подпись будет принята.

    //- Поставщик: первая подпись акта приёмки (только очная доставка).
    BaseCard.onsite-gate__card(v-for='g in supplierTasks', :key='g.key')
      template(#head)
        .onsite-gate__head
          q-icon(name='local_shipping', size='28px')
          .onsite-gate__ident
            span.onsite-gate__name Поставка на {{ kuName(g.braname) }}
            span.onsite-gate__addr(v-if='kuAddr(g.braname)')
              q-icon(name='place', size='14px')
              | {{ kuAddr(g.braname) }}
            span.onsite-gate__sub Подтвердите факт приёмки — это ваша подпись поставщика
      template(#actions)
        BaseChip(v-if='g.ttnNumbers.length', variant='neutral', size='sm')
          | {{ g.ttnNumbers.length > 1 ? 'ТТН: ' + g.ttnNumbers.length : g.ttnNumbers[0] }}

      table.onsite-gate__table
        thead
          tr
            th Товар
            th.num Кол-во
            th.num Сумма
        tbody
          tr(v-for='l in g.lines', :key='l.key')
            td {{ l.productName }}
            td.num {{ receptionLineQuantity(l) }}
            td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
        tfoot
          tr
            td Итого к приёмке
            td.num
            td.num {{ formatAsset2Digits(g.totalAmount) }} ₽

      .onsite-gate__foot
        //- До signsupp на цепи ничего нет: «Отменить» = откат черновика
        //- приёмки, оператор примет имущество заново.
        BaseButton(
          variant='ghost',
          :disabled='anySigning',
          @click='cancelSupplier(g)'
        ) Отменить
        BaseButton(
          variant='primary',
          :loading='supplierBusy(g)',
          :disabled='anySigning && !supplierBusy(g)',
          @click='signSupplier(g)'
        )
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | {{ g.lines.some((l) => l.quantity > 0) ? 'Подписать поставку' : 'Подтвердить отмену' }}

    //- Бандл выдачи: оператор уже подписал акт передачи (по заказам и/или
    //- докладке со склада) — пайщику остаётся одна подпись получения; до неё на
    //- цепи ничего нет, поэтому «Отменить» = отказ от бандла (оператор повторит).
    BaseCard.onsite-gate__card(v-for='p in proposalTasks', :key='p.id')
      template(#head)
        .onsite-gate__head
          q-icon(name='inventory_2', size='28px')
          .onsite-gate__ident
            span.onsite-gate__name Получение в пункте выдачи
            span.onsite-gate__sub Подтвердите получение имущества — ваша подпись акта

      table.onsite-gate__table
        thead
          tr
            th Товар
            th.num Кол-во
            th.num Сумма
        tbody
          tr(v-for='i in p.items', :key='i.offer_id')
            td {{ i.product_name }}
            td.num {{ proposalItemQuantity(i) }}
            td.num {{ formatAsset2Digits(proposalLineCost(i)) }} ₽
        tfoot
          tr(v-if='feePercent > 0')
            td Себестоимость
            td.num
            td.num {{ formatAsset2Digits(p.total_cost) }} ₽
          tr(v-if='feePercent > 0')
            td Членский взнос ({{ feePercent }}%)
            td.num
            td.num {{ formatAsset2Digits(proposalFeeAmount(p)) }} ₽
          tr
            td К оплате
            td.num
            td.num {{ formatAsset2Digits(proposalTotalWithFee(p)) }} ₽

      .onsite-gate__foot
        BaseButton(
          variant='ghost',
          :disabled='anySigning',
          @click='declineProposal(p)'
        ) Отменить
        BaseButton(
          variant='primary',
          :loading='proposalBusy(p.id)',
          :disabled='anySigning && !proposalBusy(p.id)',
          @click='signProposal(p)'
        )
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | Подписать и получить
</template>

<style scoped lang="scss">
.onsite-gate {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  max-width: 720px;
  margin: 0 auto;

  &__lead {
    margin: 0;
    font-size: var(--p-fs-body, 14px);
    line-height: 1.5;
    color: var(--p-ink-2);
  }

  &__card {
    width: 100%;

    :deep(.base-card__body) {
      display: flex;
      flex-direction: column;
      gap: var(--p-3, 12px);
    }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-primary);
    }
  }

  &__ident {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__addr {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    overflow-wrap: anywhere;

    .q-icon {
      flex: 0 0 auto;
      color: var(--p-ink-3);
    }
  }

  &__sub {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--p-fs-body-sm, 13px);

    th,
    td {
      padding: var(--p-2, 8px);
      border-bottom: 1px solid var(--p-line);
      text-align: left;
      color: var(--p-ink);
    }

    th {
      color: var(--p-ink-2);
      font-weight: 600;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tfoot td {
      font-weight: 600;
      border-bottom: none;
    }
  }

  &__foot {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--p-3, 12px);
  }
}
</style>
