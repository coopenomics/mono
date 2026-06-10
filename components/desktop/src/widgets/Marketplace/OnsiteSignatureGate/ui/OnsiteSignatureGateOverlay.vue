<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { BaseButton, BaseCard, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { type ReceptionGroup } from 'src/shared/lib/marketplace';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import type { MarketplaceAplReceptionView } from 'src/pages/Marketplace/OffererPendingAplReceptions/api';
import { useOnsiteSignatureGate, type OrdererPickupTask } from '../model/useOnsiteSignatureGate';

/**
 * Глобальный оверлей подписи на месте — монтируется один раз в App.vue рядом с
 * прочими app-level гейтами (RequireAgreements, SelectBranchOverlay). Сам опрос
 * и логика — в useOnsiteSignatureGate; здесь только persistent-окно и вёрстка.
 *
 * Persistent-режим (no-backdrop / no-escape / no-close): пайщик не может
 * «увести» окно — закрывает его только сама подпись (статус ушёл вперёд) либо
 * откат оператора. Это легитимное исключение из правила «не перекрывать экран»:
 * осознанный consent-gate, как онбординг-оферты.
 */

const {
  isVisible,
  signingKey,
  supplierTasks,
  ordererTasks,
  proposalTasks,
  refresh,
  signSupplier,
  signOrderer,
  acceptProposal,
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

function ordererPointLabel(task: OrdererPickupTask): string {
  return [task.pointName, task.pointAddress].filter(Boolean).join(' · ') || task.key;
}
function factQty(o: OrdererPickupTask['orders'][number]): number {
  return o.issuance_fact?.actual_quantity ?? o.quantity ?? 0;
}
function factCost(o: OrdererPickupTask['orders'][number]): string {
  return o.issuance_fact?.fact_cost ?? o.total_cost ?? '0';
}
function proposalLineCost(i: { quantity: number; unit_price: string }): string {
  return (i.quantity * Number.parseFloat(i.unit_price)).toFixed(4);
}

const supplierBusy = (g: ReceptionGroup<MarketplaceAplReceptionView>) => signingKey.value === g.key;
const ordererBusy = (t: OrdererPickupTask) => signingKey.value === t.key;
const proposalBusy = (id: string) => signingKey.value === id;
const anySigning = computed(() => signingKey.value !== null);

// Первичная загрузка состояния при монтировании оверлея (он живёт всё время
// работы приложения). Дальше гейт обновляется realtime-подпиской + catch-up'ом
// канала ядра — поллинга больше нет (Фаза 2).
onMounted(() => {
  void refresh();
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
            td.num {{ l.quantity }} {{ marketplaceUnitShort(l.unit) }}
            td.num {{ formatAsset2Digits(l.amount.toFixed(4)) }} ₽
        tfoot
          tr
            td Итого к приёмке
            td.num
            td.num {{ formatAsset2Digits(g.totalAmount) }} ₽

      .onsite-gate__foot
        BaseButton(
          variant='primary',
          :loading='supplierBusy(g)',
          :disabled='anySigning && !supplierBusy(g)',
          @click='signSupplier(g)'
        )
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | Подписать поставку

    //- Заказчик: финальная (закрывающая) подпись получения, сводно по пункту.
    BaseCard.onsite-gate__card(v-for='t in ordererTasks', :key='t.key')
      template(#head)
        .onsite-gate__head
          q-icon(name='inventory_2', size='28px')
          .onsite-gate__ident
            span.onsite-gate__name Получение в пункте выдачи
            span.onsite-gate__addr
              q-icon(name='place', size='14px')
              | {{ ordererPointLabel(t) }}
            span.onsite-gate__sub Подтвердите получение имущества — финальная подпись заказчика

      table.onsite-gate__table
        thead
          tr
            th Позиция
            th.num К получению
            th.num Сумма
        tbody
          tr(v-for='o in t.orders', :key='o.id')
            td {{ o.product_name || 'Товар по предложению' }}
            td.num {{ factQty(o) }} {{ marketplaceUnitShort(o.unit_of_measure) }}
            td.num {{ formatAsset2Digits(factCost(o)) }} ₽
        tfoot
          tr
            td Итого к получению
            td.num
            td.num {{ formatAsset2Digits(t.totalCost) }} ₽

      .onsite-gate__foot
        BaseButton(
          variant='primary',
          :loading='ordererBusy(t)',
          :disabled='anySigning && !ordererBusy(t)',
          @click='signOrderer(t)'
        )
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | Подписать и получить

    //- Докладка: оператор предложил имущество со склада кооператива — пайщик
    //- решает на месте. На принятии средства резервируются и акт придёт сюда же.
    BaseCard.onsite-gate__card(v-for='p in proposalTasks', :key='p.id')
      template(#head)
        .onsite-gate__head
          q-icon(name='add_shopping_cart', size='28px')
          .onsite-gate__ident
            span.onsite-gate__name Предложение со склада кооператива
            span.onsite-gate__sub Оператор пункта выдачи предлагает добавить к получению

      table.onsite-gate__table
        thead
          tr
            th Товар
            th.num Кол-во
            th.num Сумма
        tbody
          tr(v-for='i in p.items', :key='i.offer_id')
            td {{ i.product_name }}
            td.num {{ i.quantity }}
            td.num {{ formatAsset2Digits(proposalLineCost(i)) }} ₽
        tfoot
          tr
            td Итого (паевой взнос)
            td.num
            td.num {{ formatAsset2Digits(p.total_cost) }} ₽

      .onsite-gate__foot.onsite-gate__foot--split
        BaseButton(
          variant='ghost',
          :disabled='anySigning',
          @click='declineProposal(p)'
        ) Отказаться
        BaseButton(
          variant='primary',
          :loading='proposalBusy(p.id)',
          :disabled='anySigning && !proposalBusy(p.id)',
          @click='acceptProposal(p)'
        )
          template(#icon-left)
            q-icon(name='check', size='18px')
          | Принять предложение
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

    &--split {
      justify-content: space-between;
    }
  }
}
</style>
