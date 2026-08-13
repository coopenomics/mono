<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { BaseDialog, BaseButton, BaseBadge, BaseSelect } from 'src/shared/ui/base';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit, marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { MarketplaceSaleForm } from 'src/shared/lib/consts';

/**
 * Выбор имущества со склада кооператива для докладки в выдачу («это не пришло —
 * возьмите вот это» / магазин без предзаказа). Открывается поверх окна выдачи;
 * оператор набирает позиции опубликованного остатка ЭТОГО КУ и добавляет их в
 * тот же акт. Создание заказа из остатка и подпись — на стороне окна выдачи,
 * здесь только набор корзины.
 */

export interface StockPickLine {
  offer_id: string;
  product_name: string;
  /** Цена за единицу отпуска: за упаковку при отпуске упаковкой. */
  price_per_unit: string;
  /** Количество в единицах отпуска: число упаковок либо базовое количество. */
  quantity: number;
  unit_of_measure: string | null;
  /** Выбранная фасовка каталога — обязательна для упаковочного остатка. */
  package_id: string | null;
  /** Содержимое выбранной упаковки (Эпик 18); null — отпуск по мере. */
  stock_package_size: number | null;
}

interface CoopStockPackage {
  id: string;
  size: number;
  price: string;
  label: string | null;
  is_default: boolean;
}

type CoopStockOffer = {
  id: string;
  product_name: string;
  price_per_unit: string;
  quantity_available: number;
  stock_braname: string | null;
  sale_form: MarketplaceSaleForm;
  unit_of_measure: string | null;
  stock_package_size: number | null;
  packages: CoopStockPackage[];
};

const props = defineProps<{
  modelValue: boolean;
  braname: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'add', lines: StockPickLine[]): void;
}>();

const offers = ref<CoopStockOffer[]>([]);
const loading = ref(false);
// Количество ведётся в единицах отпуска: упаковками при упаковочном остатке,
// базовыми единицами при отпуске по мере. Упаковку не дробим — оператор
// набирает целые упаковки, как они физически лежат на складе.
const quantities = ref<Record<string, number>>({});
const selectedPackageId = ref<Record<string, string | null>>({});

const composed = computed(() =>
  offers.value
    .map((o) => ({ offer: o, quantity: quantities.value[o.id] ?? 0 }))
    .filter((l) => l.quantity > 0),
);
const total = computed(() =>
  composed.value
    .reduce((sum, l) => sum + l.quantity * Number.parseFloat(unitPrice(l.offer)), 0)
    .toFixed(4),
);

function isPackaged(offer: CoopStockOffer): boolean {
  return offer.sale_form === MarketplaceSaleForm.PACKAGED;
}

function selectedPackage(offer: CoopStockOffer): CoopStockPackage | null {
  if (!isPackaged(offer)) return null;
  const id = selectedPackageId.value[offer.id] ?? null;
  return offer.packages.find((p) => p.id === id) ?? null;
}

/** Цена единицы отпуска: упаковки при упаковочном остатке, иначе базовой. */
function unitPrice(offer: CoopStockOffer): string {
  return isPackaged(offer) ? (selectedPackage(offer)?.price ?? '0') : offer.price_per_unit;
}

/** Потолок набора в единицах отпуска — целых упаковок на складе. */
function maxQty(offer: CoopStockOffer): number {
  if (!isPackaged(offer)) return offer.quantity_available;
  const pkg = selectedPackage(offer);
  if (!pkg || pkg.size <= 0) return 0;
  return Math.floor(offer.quantity_available / pkg.size);
}

function packageOptions(offer: CoopStockOffer): Array<{ value: string; label: string }> {
  const baseLabel = marketplaceOrderUnitLabel(offer.unit_of_measure);
  return offer.packages.map((p) => {
    const sizeLabel = `${String(p.size).replace('.', ',')} ${baseLabel}`;
    return { value: p.id, label: p.label ? `${p.label} — ${sizeLabel}` : `Упаковка ${sizeLabel}` };
  });
}

function ensureDefaultPackage(offer: CoopStockOffer): void {
  if (!isPackaged(offer) || selectedPackageId.value[offer.id] !== undefined) return;
  const def = offer.packages.find((p) => p.is_default) ?? offer.packages[0] ?? null;
  selectedPackageId.value = { ...selectedPackageId.value, [offer.id]: def?.id ?? null };
}

function onPackageChange(offer: CoopStockOffer, packageId: string | number | null): void {
  selectedPackageId.value = { ...selectedPackageId.value, [offer.id]: packageId as string | null };
  // Смена фасовки меняет потолок и цену — набранное сбрасываем.
  quantities.value = { ...quantities.value, [offer.id]: 0 };
}

async function loadOffers(): Promise<void> {
  loading.value = true;
  try {
    const { [Queries.Marketplace.ListCatalog.name]: page } = await client.Query(
      Queries.Marketplace.ListCatalog.query,
      { variables: { input: { delivery_braname: props.braname, page: 1, limit: 200 } } },
    );
    // Докладываем только опубликованный остаток СО СКЛАДА этого КУ.
    offers.value = (page.items as CoopStockOffer[]).filter(
      (o) => o.stock_braname === props.braname && o.quantity_available > 0,
    );
    offers.value.forEach(ensureDefaultPackage);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function availableLabel(o: CoopStockOffer): string {
  const size = selectedPackage(o)?.size ?? o.stock_package_size;
  const saleUnit = marketplaceOrderSaleUnit(o.quantity_available, o.unit_of_measure, size);
  return `свободно ${saleUnit.units}×${saleUnit.unitLabel}`;
}

function bump(offer: CoopStockOffer, delta: number): void {
  const current = quantities.value[offer.id] ?? 0;
  const next = Math.max(0, Math.min(maxQty(offer), current + delta));
  quantities.value = { ...quantities.value, [offer.id]: next };
}

function confirmAdd(): void {
  emit(
    'add',
    composed.value.map((l) => ({
      offer_id: l.offer.id,
      product_name: l.offer.product_name,
      price_per_unit: unitPrice(l.offer),
      quantity: l.quantity,
      unit_of_measure: l.offer.unit_of_measure,
      package_id: selectedPackage(l.offer)?.id ?? null,
      stock_package_size: selectedPackage(l.offer)?.size ?? null,
    })),
  );
  quantities.value = {};
  emit('update:modelValue', false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      quantities.value = {};
      void loadOffers();
    }
  },
);
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Доложить со склада"
  size="md"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .stock-pick
    .stock-pick__intro
      | Опубликованный остаток этого пункта выдачи. Наберите позиции — они
      | добавятся в тот же акт и уйдут пайщику вместе с заказом.

    .stock-pick__empty(v-if="!loading && !offers.length")
      BaseBadge(variant="neutral") Опубликованного остатка на этом пункте нет

    .stock-pick__list(v-else)
      .stock-pick__row(v-for="o in offers", :key="o.id")
        .stock-pick__info
          span.stock-pick__name {{ o.product_name }}
          span.stock-pick__meta
            | {{ formatAsset2Digits(unitPrice(o)) }} ₽ · {{ availableLabel(o) }}
          BaseSelect(
            v-if="o.packages.length > 1"
            :model-value="selectedPackageId[o.id] ?? null"
            :options="packageOptions(o)"
            label="Упаковка"
            dense
            @update:model-value="(v: string | number | null) => onPackageChange(o, v)"
          )
        .stock-pick__qty
          BaseButton(
            variant="ghost"
            size="sm"
            :disabled="!(quantities[o.id] ?? 0)"
            @click="bump(o, -1)"
          )
            q-icon(name="remove", size="16px")
          span.stock-pick__count {{ quantities[o.id] ?? 0 }}
          BaseButton(
            variant="ghost"
            size="sm"
            :disabled="(quantities[o.id] ?? 0) >= maxQty(o)"
            @click="bump(o, 1)"
          )
            q-icon(name="add", size="16px")

  template(#footer)
    .stock-pick__foot
      span.stock-pick__total(v-if="composed.length")
        | Выбрано: {{ formatAsset2Digits(total) }} ₽
      q-space
      BaseButton(variant="ghost", @click="emit('update:modelValue', false)") Отмена
      BaseButton(variant="primary", :disabled="!composed.length", @click="confirmAdd")
        template(#icon-left)
          q-icon(name="add_shopping_cart", size="16px")
        | Добавить в выдачу
</template>

<style scoped lang="scss">
.stock-pick {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__intro {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__empty {
    display: flex;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    max-height: 50vh;
    overflow: auto;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__qty {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    flex: 0 0 auto;
  }

  &__count {
    min-width: 24px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    width: 100%;
  }

  &__total {
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }
}
</style>
