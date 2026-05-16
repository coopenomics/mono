<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Loading, Notify } from 'quasar';
import { useRouter } from 'vue-router';
import { createOffer, fetchCategories } from '../api';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferFormState,
  MarketplaceCreateOfferPayload,
  MarketplaceOfferCycleType,
  MarketplaceUnitOfMeasure,
} from '../types';

/**
 * Story 4.7: поставщик настраивает cycle_type при публикации Offer'а.
 *
 * Канон UI: `mp-role-offerer` обёртка, токены `marketplace-tokens.scss`.
 * Conditional cycle-specific поля:
 *   - time_based       → cycle_days REQUIRED; min_threshold optional
 *   - volume_based     → target_volume + max_wait_days REQUIRED
 *   - open_subscription → max_wait_days optional
 *   - individual        → нет cycle-полей
 *
 * Бэкенд (Story 3.2 + 4.7 валидация): mutation marketplaceCreateOffer,
 * статус → PENDING_MODERATION; rate-limit 10/час, baseline-категории 1-9.
 */

const router = useRouter();

const UNITS: Array<{ label: string; value: MarketplaceUnitOfMeasure }> = [
  { label: 'шт.', value: 'piece' },
  { label: 'кг', value: 'kg' },
  { label: 'литр', value: 'liter' },
  { label: 'упак.', value: 'pack' },
];

const CYCLE_TYPES: Array<{ label: string; value: MarketplaceOfferCycleType; hint: string }> = [
  {
    label: 'По расписанию (time_based)',
    value: 'time_based',
    hint: 'Поставка по истечении цикла; если набралось меньше — заказы отменятся.',
  },
  {
    label: 'По объёму (volume_based)',
    value: 'volume_based',
    hint: 'Поставка стартует когда наберётся объём; если за N дней не наберётся — заказы отменятся.',
  },
  {
    label: 'Открытая подписка (open_subscription)',
    value: 'open_subscription',
    hint: 'Я сам нажму «Запустить поставку»; пайщики могут отменить, если ждут дольше N дней.',
  },
  {
    label: 'Индивидуально (individual)',
    value: 'individual',
    hint: 'Принимаю каждый заказ индивидуально, без waiting.',
  },
];

const categories = ref<MarketplaceCategoryView[]>([]);
const submitting = ref(false);

const form = ref<MarketplaceCreateOfferFormState>({
  product_name: '',
  description: '',
  category_id: null,
  price_per_unit: '',
  unit_of_measure: 'piece',
  quantity_available: 1,
  unlimited_flag: false,
  cycle_type: 'time_based',
  cycle_days: 7,
  target_volume: null,
  max_wait_days: null,
  min_threshold: null,
  warranty_days: 0,
});

const currentCycleHint = computed(
  () => CYCLE_TYPES.find((c) => c.value === form.value.cycle_type)?.hint ?? ''
);

const isTimeBased = computed(() => form.value.cycle_type === 'time_based');
const isVolumeBased = computed(() => form.value.cycle_type === 'volume_based');
const isOpenSubscription = computed(() => form.value.cycle_type === 'open_subscription');

function onCycleTypeChange(): void {
  if (form.value.cycle_type === 'time_based') {
    form.value.target_volume = null;
    form.value.max_wait_days = null;
    if (!form.value.cycle_days) form.value.cycle_days = 7;
  } else if (form.value.cycle_type === 'volume_based') {
    form.value.cycle_days = null;
    form.value.min_threshold = null;
    if (!form.value.target_volume) form.value.target_volume = 100;
    if (!form.value.max_wait_days) form.value.max_wait_days = 30;
  } else if (form.value.cycle_type === 'open_subscription') {
    form.value.cycle_days = null;
    form.value.target_volume = null;
    form.value.min_threshold = null;
  } else {
    form.value.cycle_days = null;
    form.value.target_volume = null;
    form.value.max_wait_days = null;
    form.value.min_threshold = null;
  }
}

const categoryOptions = computed(() =>
  categories.value
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ label: c.display_name, value: c.id }))
);

function validate(): string | null {
  const f = form.value;
  if (!f.product_name.trim()) return 'Укажите название товара.';
  if (f.category_id === null) return 'Выберите категорию.';
  if (!/^\d+(\.\d{1,4})?$/.test(f.price_per_unit)) {
    return 'Цена должна быть числом (например, «100.50»).';
  }
  if (!f.unlimited_flag && (f.quantity_available === null || f.quantity_available < 0)) {
    return 'Укажите количество или включите «без ограничения».';
  }
  if (f.warranty_days < 0) return 'Срок гарантии не может быть отрицательным.';

  if (f.cycle_type === 'time_based') {
    if (!f.cycle_days || f.cycle_days < 1) {
      return 'Для time_based укажите длительность цикла в днях (целое число от 1).';
    }
  }
  if (f.cycle_type === 'volume_based') {
    if (!f.target_volume || f.target_volume < 1) {
      return 'Для volume_based укажите целевой объём (целое число от 1).';
    }
    if (!f.max_wait_days || f.max_wait_days < 1) {
      return 'Для volume_based укажите максимальный срок ожидания (целое число от 1).';
    }
  }
  return null;
}

async function onSubmit(): Promise<void> {
  const error = validate();
  if (error) {
    Notify.create({ type: 'negative', message: error });
    return;
  }

  const f = form.value;
  const payload: MarketplaceCreateOfferPayload = {
    product_name: f.product_name.trim(),
    description: f.description.trim() ? f.description.trim() : null,
    category_id: f.category_id as number,
    price_per_unit: f.price_per_unit,
    unit_of_measure: f.unit_of_measure,
    quantity_available: f.unlimited_flag ? null : f.quantity_available,
    unlimited_flag: f.unlimited_flag,
    cycle_type: f.cycle_type,
    cycle_days: f.cycle_type === 'time_based' ? f.cycle_days : null,
    target_volume: f.cycle_type === 'volume_based' ? f.target_volume : null,
    max_wait_days:
      f.cycle_type === 'volume_based' || f.cycle_type === 'open_subscription'
        ? f.max_wait_days
        : null,
    min_threshold: f.cycle_type === 'time_based' ? f.min_threshold : null,
    warranty_days: f.warranty_days,
  };

  submitting.value = true;
  Loading.show({ message: 'Создаю предложение…' });
  try {
    const result = await createOffer(payload);
    Notify.create({
      type: 'positive',
      message: `Предложение создано (id ${result.id.slice(0, 8)}), статус: ${result.status}.`,
    });
    void router.push({ name: 'marketplace-catalog' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message, timeout: 6000 });
  } finally {
    Loading.hide();
    submitting.value = false;
  }
}

onMounted(async () => {
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  }
});
</script>

<template>
  <q-page class="mp-role-offerer mp-create-offer q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h5">Новое предложение</div>
    </div>

    <q-card flat bordered class="mp-create-offer__card">
      <q-card-section>
        <q-form class="q-gutter-md" @submit.prevent="onSubmit">
          <q-input
            v-model="form.product_name"
            label="Название товара *"
            outlined
            dense
            :rules="[(v: string) => !!v.trim() || 'Обязательное поле']"
            maxlength="200"
          />

          <q-input
            v-model="form.description"
            label="Описание"
            outlined
            dense
            type="textarea"
            autogrow
            maxlength="2000"
          />

          <q-select
            v-model="form.category_id"
            :options="categoryOptions"
            map-options
            emit-value
            option-label="label"
            option-value="value"
            label="Категория *"
            outlined
            dense
            :rules="[(v: number | null) => v !== null || 'Выберите категорию']"
          />

          <div class="row q-col-gutter-md">
            <q-input
              v-model="form.price_per_unit"
              label="Цена за единицу *"
              outlined
              dense
              class="col"
              hint="До 4 знаков после запятой, например 100.5000"
            />
            <q-select
              v-model="form.unit_of_measure"
              :options="UNITS"
              map-options
              emit-value
              option-label="label"
              option-value="value"
              label="Единица *"
              outlined
              dense
              class="col"
            />
          </div>

          <div class="row q-col-gutter-md items-center">
            <q-input
              v-if="!form.unlimited_flag"
              v-model.number="form.quantity_available"
              label="Доступное количество *"
              type="number"
              min="0"
              outlined
              dense
              class="col"
            />
            <q-toggle
              v-model="form.unlimited_flag"
              label="Без ограничения по количеству"
              :class="form.unlimited_flag ? 'col' : 'col-auto'"
            />
          </div>

          <q-input
            v-model.number="form.warranty_days"
            label="Гарантия (дней)"
            type="number"
            min="0"
            outlined
            dense
          />

          <q-separator />

          <div class="text-subtitle1 q-mb-sm">Тип отсечки заказов *</div>
          <q-option-group
            v-model="form.cycle_type"
            :options="CYCLE_TYPES"
            type="radio"
            inline
            @update:model-value="onCycleTypeChange"
          />
          <div class="text-caption text-grey-7 q-mt-xs">
            {{ currentCycleHint }}
          </div>

          <div v-if="isTimeBased" class="mp-create-offer__cycle-fields q-mt-md">
            <q-input
              v-model.number="form.cycle_days"
              label="Длительность цикла (дней) *"
              type="number"
              min="1"
              outlined
              dense
              hint="Поставка по истечении цикла."
              :rules="[(v: number | null) => (v !== null && v >= 1) || 'От 1 дня']"
            />
            <q-input
              v-model.number="form.min_threshold"
              label="Минимальный порог объёма (опц.)"
              type="number"
              min="0"
              outlined
              dense
              class="q-mt-md"
              hint="Если к концу цикла набралось меньше — все заказы отменятся."
            />
          </div>

          <div v-if="isVolumeBased" class="mp-create-offer__cycle-fields q-mt-md">
            <q-input
              v-model.number="form.target_volume"
              label="Целевой объём *"
              type="number"
              min="1"
              outlined
              dense
              :rules="[(v: number | null) => (v !== null && v >= 1) || 'От 1']"
            />
            <q-input
              v-model.number="form.max_wait_days"
              label="Максимальный срок ожидания (дней) *"
              type="number"
              min="1"
              outlined
              dense
              class="q-mt-md"
              :rules="[(v: number | null) => (v !== null && v >= 1) || 'От 1 дня']"
            />
          </div>

          <div v-if="isOpenSubscription" class="mp-create-offer__cycle-fields q-mt-md">
            <q-input
              v-model.number="form.max_wait_days"
              label="Лимит ожидания пайщика (дней, опц.)"
              type="number"
              min="1"
              outlined
              dense
              hint="После этого срока пайщик может отменить заказ сам."
            />
          </div>

          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn
              flat
              no-caps
              label="Отменить"
              :disable="submitting"
              @click="router.back()"
            />
            <q-btn
              unelevated
              color="primary"
              no-caps
              type="submit"
              label="Опубликовать на модерацию"
              :loading="submitting"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped lang="scss">
.mp-create-offer {
  max-width: 760px;
  margin: 0 auto;

  &__card {
    background-color: var(--mp-surface, white);
  }

  &__cycle-fields {
    padding-left: var(--mp-space-md, 12px);
    border-left: 2px solid var(--mp-divider, #e0e0e0);
  }
}
</style>
