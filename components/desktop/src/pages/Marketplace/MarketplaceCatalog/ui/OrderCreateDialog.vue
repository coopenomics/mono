<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
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
q-dialog(v-model="open", :persistent="submitting")
  q-card.mp-order-create-dialog(style="min-width: 360px; max-width: 480px")
    q-card-section
      div.text-h6 Оформление заказа
      div.text-subtitle2.text-grey-7(v-if="offer") {{ offer.product_name }}
    q-separator
    q-card-section.q-gutter-md
      q-input(
        v-model.number="quantity",
        type="number",
        :min="1",
        :max="maxQuantity ?? undefined",
        :label="`Количество (${unitLabel})`",
        :hint="maxQuantity !== null ? `Доступно: ${maxQuantity} ${unitLabel}` : 'Без ограничения остатка'",
        outlined,
        dense
      )
      q-select(
        v-model="branch",
        :options="branchOptions",
        option-value="value",
        option-label="label",
        emit-value,
        map-options,
        outlined,
        dense,
        label="ПВЗ доставки",
        :loading="loadingBranches",
        :disable="branchOptions.length === 0"
      )
      div.text-body2(v-if="offer")
        | Цена: {{ Number(offer.price_per_unit).toLocaleString('ru-RU') }} {{ system.governSymbol }} за {{ unitLabel }}
      div.text-h6.text-primary(v-if="offer")
        | Итого: {{ totalSum.toLocaleString('ru-RU') }} {{ system.governSymbol }}
    q-card-actions(align="right")
      q-btn(flat, label="Отмена", :disable="submitting", @click="open = false")
      q-btn(
        unelevated,
        color="primary",
        label="Подтвердить заказ",
        :disable="!canSubmit",
        :loading="submitting",
        @click="onSubmit"
      )
</template>
