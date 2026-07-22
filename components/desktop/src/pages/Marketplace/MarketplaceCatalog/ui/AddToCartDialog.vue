<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { applyMembershipFee } from 'src/shared/lib/marketplace';
import { BaseDialog, BaseInput, BaseButton } from 'src/shared/ui/base';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import type { MarketplaceOfferView } from '../types';

// Минимально необходимый набор полей оффера для добавления в корзину —
// структурно совместим и с каталожным (MarketplaceOfferView), и с детальным
// (MarketplaceOfferDetailView) представлением, чтобы диалог переиспользовался.
type CartOffer = Pick<
  MarketplaceOfferView,
  'id' | 'product_name' | 'unit_of_measure' | 'order_unit_size' | 'unlimited_flag' | 'quantity_available' | 'price_per_unit'
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

const quantity = ref<number>(1);
const submitting = ref<boolean>(false);

const unitLabel = computed(() =>
  marketplaceOrderUnitLabel(props.offer?.unit_of_measure, props.offer?.order_unit_size),
);

const maxQuantity = computed(() => {
  if (!props.offer) return null;
  if (props.offer.unlimited_flag) return null;
  return props.offer.quantity_available;
});

const priceWithFee = computed(() => {
  if (!props.offer) return 0;
  return applyMembershipFee(Number(props.offer.price_per_unit), props.feePercent);
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
  if (!Number.isInteger(q) || q < 1) return false;
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
    if (v) quantity.value = 1;
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
      BaseInput(
        :model-value="quantity",
        type="number",
        :label="`Количество (${unitLabel})`",
        :hint="maxQuantity !== null ? `Доступно: ${maxQuantity} ${unitLabel}` : 'Без ограничения остатка'",
        @update:model-value="onQuantityInput"
      )
      .add-to-cart__note(v-if="alreadyInCart > 0")
        | Уже в корзине: {{ alreadyInCart }} {{ unitLabel }} — добавление суммируется.
      .add-to-cart__price(v-if="offer")
        | Цена: {{ priceWithFee.toLocaleString('ru-RU') }} {{ system.governSymbol }} за {{ unitLabel }}
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
