<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { BaseDialog, BaseInput, BaseSelect, BaseButton } from 'src/shared/ui/base';
import { fetchBranchOptions, submitCreateOrder } from '../api';
import type { BranchOption, MarketplaceOfferView } from '../types';

const system = useSystemStore();

const props = defineProps<{
  modelValue: boolean;
  coopname: string;
  offer: MarketplaceOfferView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const UNIT_LABEL: Record<MarketplaceOfferView['unit_of_measure'], string> = {
  piece: 'шт',
  kg: 'кг',
  liter: 'л',
  pack: 'упак',
};

const quantity = ref<number>(1);
const branch = ref<string | null>(null);
const branches = ref<BranchOption[]>([]);
const loadingBranches = ref<boolean>(false);
const submitting = ref<boolean>(false);

const unitLabel = computed(() =>
  props.offer ? UNIT_LABEL[props.offer.unit_of_measure] : '',
);

const maxQuantity = computed(() => {
  if (!props.offer) return null;
  if (props.offer.unlimited_flag) return null;
  return props.offer.quantity_available;
});

const totalSum = computed(() => {
  if (!props.offer) return 0;
  const q = Number(quantity.value) || 0;
  return q * Number(props.offer.price_per_unit);
});

const branchOptions = computed(() =>
  branches.value.map((b) => ({
    label: b.city ? `${b.short_name} — ${b.city}` : b.short_name,
    value: b.braname,
  })),
);

const canSubmit = computed(() => {
  if (!props.offer || !branch.value) return false;
  const q = Number(quantity.value);
  if (!Number.isInteger(q) || q < 1) return false;
  if (maxQuantity.value !== null && q > maxQuantity.value) return false;
  return true;
});

function onQuantityInput(value: string | number | null): void {
  const n = Number(value);
  quantity.value = Number.isNaN(n) ? 0 : n;
}

function onBranchSelect(value: string | number | null): void {
  branch.value = value == null ? null : String(value);
}

watch(
  () => props.modelValue,
  async (v) => {
    if (!v) return;
    quantity.value = 1;
    branch.value = null;
    if (branches.value.length === 0) {
      loadingBranches.value = true;
      try {
        branches.value = await fetchBranchOptions(props.coopname);
        if (branches.value.length === 1) {
          branch.value = branches.value[0]!.braname;
        }
      } catch (e) {
        FailAlert(e, 'Не удалось загрузить ПВЗ');
      } finally {
        loadingBranches.value = false;
      }
    } else if (branches.value.length === 1) {
      branch.value = branches.value[0]!.braname;
    }
  },
);

async function onSubmit(): Promise<void> {
  if (!props.offer || !branch.value) return;
  submitting.value = true;
  try {
    await submitCreateOrder({
      offer_id: props.offer.id,
      quantity: Number(quantity.value),
      delivery_braname: branch.value,
    });
    SuccessAlert('Заказ создан');
    emit('created');
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
  title="Оформление заказа",
  size="sm",
  :close-on-backdrop="!submitting",
  @update:model-value="(v) => open = v"
)
  template(#default)
    .order-create
      .order-create__offer(v-if="offer") {{ offer.product_name }}
      BaseInput(
        :model-value="quantity",
        type="number",
        :label="`Количество (${unitLabel})`",
        :hint="maxQuantity !== null ? `Доступно: ${maxQuantity} ${unitLabel}` : 'Без ограничения остатка'",
        @update:model-value="onQuantityInput"
      )
      BaseSelect(
        :model-value="branch",
        :options="branchOptions",
        label="ПВЗ доставки",
        :disabled="branchOptions.length === 0",
        :hint="loadingBranches ? 'Загружаю пункты выдачи…' : undefined",
        @update:model-value="onBranchSelect"
      )
      .order-create__price(v-if="offer")
        | Цена: {{ Number(offer.price_per_unit).toLocaleString('ru-RU') }} {{ system.governSymbol }} за {{ unitLabel }}
      .order-create__total(v-if="offer")
        | Итого: {{ totalSum.toLocaleString('ru-RU') }} {{ system.governSymbol }}
  template(#footer)
    BaseButton(variant="ghost", :disabled="submitting", @click="open = false") Отмена
    BaseButton(
      variant="primary",
      :disabled="!canSubmit",
      :loading="submitting",
      @click="onSubmit"
    ) Подтвердить заказ
</template>

<style scoped lang="scss">
.order-create {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__offer {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
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
