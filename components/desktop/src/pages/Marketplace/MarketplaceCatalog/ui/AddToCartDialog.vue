<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { applyMembershipFee, saleQuantityStep } from 'src/shared/lib/marketplace';
import { BaseDialog, BaseInput, BaseButton } from 'src/shared/ui/base';
import { marketplaceOrderUnitLabel, MarketplaceSaleForm } from 'src/shared/lib/consts';
import type { MarketplaceOfferView } from '../types';

// Минимально необходимый набор полей оффера для добавления в корзину —
// структурно совместим и с каталожным (MarketplaceOfferView), и с детальным
// (MarketplaceOfferDetailView) представлением, чтобы диалог переиспользовался.
type CartOffer = Pick<
  MarketplaceOfferView,
  'id' | 'product_name' | 'unit_of_measure' | 'unlimited_flag' | 'quantity_available' | 'price_per_unit'
  | 'sale_form' | 'packages'
>;

/**
 * Эпик 16 / Story 16.1: добавление позиции в корзину из каталога.
 *
 * КУ здесь НЕ выбирается — он глобальный (выбран при присоединении, виден в
 * шапке стола). Каталог уже отфильтрован под текущий КУ, поэтому всё, что
 * видно, на этот КУ доставимо. Диалог спрашивает только количество и кладёт
 * позицию в корзину (`addToCart` с текущим delivery_braname). Оформление —
 * отдельным шагом на странице корзины (checkout).
 */
const system = useSystemStore();
const cartStore = useMarketplaceCartStore();
const router = useRouter();
const route = useRoute();

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    offer: CartOffer | null;
    // Единая ставка членского взноса кооператива, проценты (requirement b6).
    // Цена и итог показываются заказчику с учётом взноса — как в каталоге.
    feePercent?: number;
  }>(),
  { feePercent: 0 },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'added'): void;
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

// Эпик 18: quantity — количество в базовой единице (по мере) либо число
// упаковок (упаковкой) выбранной упаковки selectedPackageId.
const quantity = ref<number>(1);
const selectedPackageId = ref<string | null>(null);
const submitting = ref<boolean>(false);

const isPackaged = computed(() => props.offer?.sale_form === MarketplaceSaleForm.PACKAGED);
const unitLabel = computed(() =>
  marketplaceOrderUnitLabel(props.offer?.unit_of_measure),
);
// Шаг ввода: по мере — штука целая (1), вес/объём дробный (0.001); упаковкой — целое.
const quantityStep = computed(() => saleQuantityStep(props.offer));

// Подпись варианта в селекте — название (если задано) ВСЕГДА вместе с
// размером упаковки, а не вместо него: заказчику нужно видеть объём сразу
// при выборе, не выбирая упаковку заранее ради строки «Цена: ... за упак.» под селектом.
const packageOptions = computed(() =>
  (props.offer?.packages ?? []).map((p) => {
    const sizeLabel = `${String(p.size).replace('.', ',')} ${unitLabel.value}`;
    const nameLabel = p.label ? `${p.label} — ${sizeLabel}` : `Упаковка ${sizeLabel}`;
    const priceLabel = `${applyMembershipFee(Number(p.price), props.feePercent).toLocaleString('ru-RU')} ${system.governSymbol}`;
    return {
      value: p.id,
      label: `${nameLabel} — ${priceLabel}`,
    };
  }),
);

const selectedPackage = computed(() =>
  (props.offer?.packages ?? []).find((p) => p.id === selectedPackageId.value) ?? null,
);

const maxQuantity = computed(() => {
  if (!props.offer) return null;
  if (props.offer.unlimited_flag) return null;
  // Остаток в базовых единицах; при упаковке — переводим в число упаковок.
  if (isPackaged.value && selectedPackage.value) {
    return Math.floor(props.offer.quantity_available / selectedPackage.value.size);
  }
  return props.offer.quantity_available;
});

// Цена единицы отпуска (с взносом): по мере — за базовую единицу; упаковкой — за упаковку.
const priceWithFee = computed(() => {
  if (!props.offer) return 0;
  const base = isPackaged.value
    ? Number(selectedPackage.value?.price ?? 0)
    : Number(props.offer.price_per_unit);
  return applyMembershipFee(base, props.feePercent);
});

const saleUnitLabel = computed(() => {
  if (isPackaged.value && selectedPackage.value) {
    return `упак. ${String(selectedPackage.value.size).replace('.', ',')} ${unitLabel.value}`;
  }
  return unitLabel.value;
});

const totalSum = computed(() => {
  const q = Number(quantity.value) || 0;
  return q * priceWithFee.value;
});

// Сколько этой позиции уже в корзине — подсказка, чтобы заказчик не дублировал.
const alreadyInCart = computed(() => {
  if (!props.offer) return 0;
  return cartStore.itemByOffer(props.offer.id)?.quantity ?? 0;
});

const canSubmit = computed(() => {
  if (!props.offer) return false;
  const q = Number(quantity.value);
  if (!(q > 0)) return false;
  if (isPackaged.value) {
    if (!selectedPackageId.value) return false;
    if (!Number.isInteger(q)) return false;
  }
  if (maxQuantity.value !== null && q > maxQuantity.value) return false;
  return true;
});

function onQuantityInput(value: string | number | null): void {
  const n = Number(value);
  quantity.value = Number.isNaN(n) ? 0 : n;
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      quantity.value = 1;
      // Предвыбираем упаковку по умолчанию (или первую).
      const pkgs = props.offer?.packages ?? [];
      selectedPackageId.value = isPackaged.value
        ? (pkgs.find((p) => p.is_default)?.id ?? pkgs[0]?.id ?? null)
        : null;
    }
  },
);

async function onSubmit(): Promise<void> {
  if (!props.offer) return;
  submitting.value = true;
  try {
    await cartStore.addItem(
      props.offer.id,
      Number(quantity.value),
      cartStore.currentBraname,
      isPackaged.value ? selectedPackageId.value : null,
    );
    // CTA прямо в тосте: быстрый переход к оформлению, чтобы не искать корзину
    // отдельно. Заказал одну позицию — сразу из всплывашки идёшь в корзину.
    SuccessAlert('Добавлено в корзину', {
      text: 'В корзину',
      icon: 'shopping_cart',
      handler: () => {
        void router.push({
          name: 'marketplace-cart',
          params: { coopname: String(route.params.coopname ?? '') },
        });
      },
    });
    emit('added');
    open.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template lang="pug">
BaseDialog(
  :model-value="open",
  title="В корзину",
  size="sm",
  :close-on-backdrop="!submitting",
  @update:model-value="(v) => open = v"
)
  template(#default)
    .add-to-cart
      .add-to-cart__offer(v-if="offer") {{ offer.product_name }}
      q-select(
        v-if="isPackaged",
        :model-value="selectedPackageId",
        :options="packageOptions",
        label="Упаковка",
        outlined,
        dense,
        emit-value,
        map-options,
        @update:model-value="(v) => selectedPackageId = v"
      )
      BaseInput(
        :model-value="quantity",
        type="number",
        :step="quantityStep",
        :label="isPackaged ? 'Число упаковок' : `Количество (${unitLabel})`",
        :hint="maxQuantity !== null ? `Доступно: ${maxQuantity} ${isPackaged ? 'упак.' : unitLabel}` : 'Без ограничения остатка'",
        @update:model-value="onQuantityInput"
      )
      .add-to-cart__note(v-if="alreadyInCart > 0")
        | Уже в корзине: {{ alreadyInCart }} — добавление суммируется.
      .add-to-cart__price(v-if="offer")
        | Цена: {{ priceWithFee.toLocaleString('ru-RU') }} {{ system.governSymbol }} за {{ saleUnitLabel }}
      .add-to-cart__total(v-if="offer")
        | Итого: {{ totalSum.toLocaleString('ru-RU') }} {{ system.governSymbol }}
  template(#footer)
    BaseButton(variant="ghost", :disabled="submitting", @click="open = false") Отмена
    BaseButton(
      variant="primary",
      :disabled="!canSubmit",
      :loading="submitting",
      @click="onSubmit"
    ) Добавить в корзину
</template>

<style scoped lang="scss">
.add-to-cart {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__offer {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }

  &__note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__price {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__total {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-primary-strong);
  }
}
</style>
