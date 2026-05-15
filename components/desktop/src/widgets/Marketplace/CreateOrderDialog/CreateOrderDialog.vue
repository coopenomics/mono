<template>
  <TakeoverDialog
    v-model="open"
    :title="title"
    kind="info"
    :loading="submitting"
    :disable-confirm="!canSubmit"
    confirm-label="Оформить заказ"
    cancel-label="Закрыть"
    @cancel="emit('cancel')"
    @confirm="onSubmit"
  >
    <div class="mp-create-order mp-role-orderer">
      <div v-if="offer" class="mp-create-order__offer">
        <div class="mp-create-order__offer-title">{{ offer.title }}</div>
        <div v-if="offer.unitCost != null" class="mp-create-order__offer-price">
          {{ pricePerUnit }} ₽ / {{ unitLabel }}
        </div>
      </div>

      <div class="mp-create-order__field">
        <label class="mp-create-order__label" for="mp-create-order-qty">Количество</label>
        <q-input
          id="mp-create-order-qty"
          v-model.number="quantity"
          type="number"
          dense
          outlined
          min="1"
          :max="maxQuantity"
          :error="!!quantityError"
          :error-message="quantityError ?? undefined"
          :hint="maxQuantity != null ? `Доступно: ${maxQuantity} ${unitLabel}` : undefined"
        />
      </div>

      <div class="mp-create-order__field">
        <div class="mp-create-order__label">ПВЗ получения</div>
        <KUMapWithList
          :items="kuItems"
          :loading="kuLoading"
          :selected-braname="deliveryBraname"
          aria-label="Выбор ПВЗ для получения заказа"
          @select="onSelectKU"
        />
        <div v-if="deliveryBranameError" class="mp-create-order__error">{{ deliveryBranameError }}</div>
      </div>

      <div v-if="totalCost != null" class="mp-create-order__total">
        Итог: <strong>{{ totalCostFormatted }}</strong>
        <span class="mp-create-order__total-hint">
          — будет заблокировано на вашем кошельке программы «Стол заказов»
        </span>
      </div>
    </div>
  </TakeoverDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TakeoverDialog } from '../TakeoverDialog'
import { KUMapWithList } from '../../KUMapWithList'
import type { IMarketplaceKUDetails } from 'src/entities/MarketplaceKUDetails'

export interface CreateOrderOfferContext {
  id: string
  title: string
  unitCost?: number | string
  unitLabel?: string
  remainUnits?: number
  unlimited?: boolean
}

export interface CreateOrderSubmitPayload {
  offerId: string
  quantity: number
  deliveryBraname: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    offer: CreateOrderOfferContext | null
    kuItems: IMarketplaceKUDetails[]
    kuLoading?: boolean
    submitting?: boolean
  }>(),
  {
    kuLoading: false,
    submitting: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'cancel'): void
  (e: 'submit', payload: CreateOrderSubmitPayload): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const quantity = ref<number>(1)
const deliveryBraname = ref<string | null>(null)

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      quantity.value = 1
      deliveryBraname.value = null
    }
  }
)

const title = computed(() => (props.offer ? `Заказ: ${props.offer.title}` : 'Оформление заказа'))
const unitLabel = computed(() => props.offer?.unitLabel ?? 'ед.')

const maxQuantity = computed<number | null>(() => {
  if (!props.offer) return null
  if (props.offer.unlimited) return null
  return typeof props.offer.remainUnits === 'number' ? props.offer.remainUnits : null
})

const pricePerUnit = computed<string>(() => {
  if (!props.offer || props.offer.unitCost == null) return ''
  const n = typeof props.offer.unitCost === 'string' ? Number.parseFloat(props.offer.unitCost) : props.offer.unitCost
  return n.toFixed(2)
})

const totalCost = computed<number | null>(() => {
  if (!props.offer || props.offer.unitCost == null) return null
  const n = typeof props.offer.unitCost === 'string' ? Number.parseFloat(props.offer.unitCost) : props.offer.unitCost
  if (!Number.isFinite(n) || !Number.isFinite(quantity.value)) return null
  return n * quantity.value
})

const totalCostFormatted = computed(() => (totalCost.value != null ? `${totalCost.value.toFixed(2)} ₽` : ''))

const quantityError = computed<string | null>(() => {
  if (!Number.isInteger(quantity.value) || quantity.value <= 0) return 'Введите целое количество больше нуля'
  if (maxQuantity.value != null && quantity.value > maxQuantity.value) {
    return `Доступно только ${maxQuantity.value} ${unitLabel.value}`
  }
  return null
})

const deliveryBranameError = computed<string | null>(() =>
  !deliveryBraname.value ? 'Выберите ПВЗ из списка или на карте' : null
)

const canSubmit = computed(() => !quantityError.value && !deliveryBranameError.value && !!props.offer)

function onSelectKU(pvz: IMarketplaceKUDetails) {
  deliveryBraname.value = pvz.coreBraname
}

function onSubmit() {
  if (!props.offer || !deliveryBraname.value) return
  emit('submit', {
    offerId: props.offer.id,
    quantity: quantity.value,
    deliveryBraname: deliveryBraname.value,
  })
}
</script>

<style scoped lang="scss">
.mp-create-order {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-lg);
}

.mp-create-order__offer {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-xs);
  padding-bottom: var(--mp-space-md);
  border-bottom: 1px solid var(--mp-border-subtle);
}

.mp-create-order__offer-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--mp-on-surface);
}

.mp-create-order__offer-price {
  font-size: 15px;
  color: var(--mp-on-surface-muted);
}

.mp-create-order__field {
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-xs);
}

.mp-create-order__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--mp-on-surface-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.mp-create-order__error {
  font-size: 13px;
  color: var(--q-negative);
}

.mp-create-order__total {
  margin-top: var(--mp-space-sm);
  font-size: 16px;
  color: var(--mp-on-surface);
}

.mp-create-order__total-hint {
  display: block;
  margin-top: var(--mp-space-xs);
  font-size: 13px;
  color: var(--mp-on-surface-muted);
}
</style>
