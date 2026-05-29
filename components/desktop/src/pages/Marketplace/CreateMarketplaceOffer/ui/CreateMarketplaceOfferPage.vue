<template lang="pug">
q-page.mp-role-offerer.offer-wizard(role='region', aria-label='Создание предложения')
  .offer-wizard__col
    header.offer-wizard__head
      h1.offer-wizard__title {{ pageTitle }}
      p.offer-wizard__intro
        | Заполните карточку товара по шагам. После публикации предложение
        | уходит на модерацию председателю — до одобрения оно не появится в каталоге.

    q-banner.offer-wizard__notice(v-if='isEdit', rounded, dense)
      template(#avatar)
        q-icon(name='fa-solid fa-circle-info', color='warning')
      | После сохранения предложение снова отправится на модерацию — до одобрения
      | оно будет недоступно в каталоге.

    q-inner-loading(:showing='prefilling')
      q-spinner(color='primary', size='2em')

    VerticalStepper(
      :steps='steps',
      :active-key='activeKey',
      :completed='completedKeys',
      @change='goToStep'
    )
      template(#active='{ step }')
        //- ───────── Шаг 1: Товар ─────────
        q-form.offer-wizard__step(v-if='step.key === "basics"', ref='basicsForm', greedy)
          q-input(
            v-model='form.product_name',
            label='Название товара',
            outlined,
            reserve-hint-space,
            :maxlength='200',
            counter,
            hint='Как товар увидят заказчики в каталоге',
            :rules='[(v) => !!(v && v.trim()) || "Укажите название товара"]'
          )
          q-select(
            v-model='form.category_id',
            :options='categoryOptions',
            label='Категория',
            outlined,
            reserve-hint-space,
            emit-value,
            map-options,
            :rules='[(v) => v !== null || "Выберите категорию"]'
          )
          q-input(
            v-model='form.description',
            label='Описание (необязательно)',
            outlined,
            reserve-hint-space,
            type='textarea',
            autogrow,
            :maxlength='2000',
            counter,
            hint='Состав, производитель, особенности — всё, что поможет заказчику'
          )

        //- ───────── Шаг 2: Цена и наличие ─────────
        q-form.offer-wizard__step(v-else-if='step.key === "pricing"', ref='pricingForm', greedy)
          .offer-wizard__row
            q-input(
              v-model='form.price_per_unit',
              label='Цена за единицу',
              outlined,
              reserve-hint-space,
              hint='До 4 знаков после запятой, например 100.50',
              :rules='[priceRule]'
            )
            q-select(
              v-model='form.unit_of_measure',
              :options='unitOptions',
              label='Единица измерения',
              outlined,
              reserve-hint-space,
              emit-value,
              map-options
            )
          .offer-wizard__qty
            q-input(
              v-if='!form.unlimited_flag',
              v-model.number='form.quantity_available',
              label='Доступное количество',
              type='number',
              min='0',
              outlined,
              reserve-hint-space,
              :rules='[(v) => (v !== null && v >= 0) || "Укажите количество или включите «без ограничения»"]'
            )
            BaseCheckbox(
              :model-value='form.unlimited_flag',
              label='Без ограничения по количеству',
              @update:model-value='form.unlimited_flag = $event'
            )
          q-input(
            v-model.number='form.warranty_days',
            label='Гарантия (дней)',
            type='number',
            min='0',
            outlined,
            reserve-hint-space,
            hint='0 — без гарантийного срока',
            :rules='[(v) => (v !== null && v >= 0) || "Срок гарантии не может быть отрицательным"]'
          )

        //- ───────── Шаг 3: Условия поставки ─────────
        .offer-wizard__step(v-else-if='step.key === "supply"')
          .offer-wizard__field-label Как набираются и отсекаются заказы
          .offer-wizard__cards
            BaseRadioCard(
              v-for='opt in cycleTypeOptions',
              :key='opt.value',
              :model-value='form.cycle_type',
              :value='opt.value',
              :title='opt.title',
              :description='opt.description',
              @update:model-value='onSelectCycle(opt.value)'
            )

          //- conditional поля по типу отсечки
          .offer-wizard__conditional(v-if='isTimeBased')
            q-input(
              v-model.number='form.cycle_days',
              label='Длительность цикла (дней)',
              type='number',
              min='1',
              outlined,
              reserve-hint-space,
              hint='Поставка по истечении цикла'
            )
            q-input(
              v-model.number='form.min_threshold',
              label='Минимальный порог объёма (необязательно)',
              type='number',
              min='0',
              outlined,
              reserve-hint-space,
              hint='Если к концу цикла набралось меньше — все заказы отменятся'
            )
          .offer-wizard__conditional(v-else-if='isVolumeBased')
            q-input(
              v-model.number='form.target_volume',
              label='Целевой объём',
              type='number',
              min='1',
              outlined,
              reserve-hint-space,
              hint='Поставка стартует, когда наберётся этот объём'
            )
            q-input(
              v-model.number='form.max_wait_days',
              label='Максимальный срок ожидания (дней)',
              type='number',
              min='1',
              outlined,
              reserve-hint-space,
              hint='Если за этот срок объём не набрался — заказы отменятся'
            )
          .offer-wizard__conditional(v-else-if='isOpenSubscription')
            q-input(
              v-model.number='form.max_wait_days',
              label='Лимит ожидания заказчика (дней, необязательно)',
              type='number',
              min='1',
              outlined,
              reserve-hint-space,
              hint='После этого срока заказчик может отменить заказ сам'
            )
          .offer-wizard__hint(v-else)
            | Каждый заказ принимается индивидуально, без ожидания набора.

        //- ───────── Шаг 4: Изображения ─────────
        .offer-wizard__step(v-else-if='step.key === "images"')
          .offer-wizard__field-label Фотографии товара
          p.offer-wizard__hint
            | До {{ MAX_IMAGES }} изображений, каждое до {{ MAX_MB }} МБ (JPEG, PNG или WEBP).
            | Первое изображение станет обложкой карточки.

          .offer-wizard__existing(v-if='isEdit && existingImages.length && !imageDrafts.length')
            .offer-wizard__field-label.offer-wizard__field-label--sub Текущие изображения
            .offer-wizard__grid
              .offer-wizard__thumb(v-for='(img, i) in existingImages', :key='img.url')
                q-img.offer-wizard__img(:src='img.url', ratio='1')
                BaseChip.offer-wizard__cover(v-if='i === 0', variant='accent', size='sm') Обложка
            p.offer-wizard__hint.offer-wizard__hint--muted
              | Загрузка новых изображений заменит текущие.

          .offer-wizard__grid(v-if='imageDrafts.length')
            .offer-wizard__thumb(v-for='(img, i) in imageDrafts', :key='img.preview_url')
              q-img.offer-wizard__img(:src='img.preview_url', ratio='1')
              BaseChip.offer-wizard__cover(v-if='i === 0', variant='accent', size='sm') Обложка
              q-btn.offer-wizard__remove(
                round,
                dense,
                size='sm',
                icon='close',
                color='negative',
                aria-label='Удалить изображение',
                @click='removeImage(i)'
              )

          q-file(
            v-model='picked',
            label='Добавить изображения',
            outlined,
            multiple,
            accept='image/jpeg,image/png,image/webp',
            :disable='imageDrafts.length >= MAX_IMAGES',
            @update:model-value='onPickFiles'
          )
            template(#prepend)
              q-icon(name='fa-solid fa-image')

        //- ───────── Шаг 5: Проверка ─────────
        .offer-wizard__step(v-else-if='step.key === "review"')
          .offer-review
            .offer-review__row
              span.offer-review__label Название
              span.offer-review__value {{ form.product_name || '—' }}
            .offer-review__row
              span.offer-review__label Категория
              span.offer-review__value {{ selectedCategoryLabel }}
            .offer-review__row(v-if='form.description')
              span.offer-review__label Описание
              span.offer-review__value {{ form.description }}
            .offer-review__row
              span.offer-review__label Цена
              span.offer-review__value {{ form.price_per_unit || '—' }} / {{ selectedUnitLabel }}
            .offer-review__row
              span.offer-review__label Количество
              span.offer-review__value {{ form.unlimited_flag ? 'Без ограничения' : form.quantity_available }}
            .offer-review__row
              span.offer-review__label Гарантия
              span.offer-review__value {{ form.warranty_days }} дн.
            .offer-review__row
              span.offer-review__label Отсечка заказов
              span.offer-review__value {{ selectedCycleTitle }}
            .offer-review__row
              span.offer-review__label Изображения
              span.offer-review__value {{ reviewImagesLabel }}

    //- ───────── Навигация ─────────
    footer.offer-wizard__foot
      BaseButton(
        v-if='activeKey === firstStepKey',
        variant='ghost',
        :disabled='submitting',
        @click='onCancel'
      ) Отменить
      BaseButton(v-else, variant='ghost', :disabled='submitting', @click='goBack')
        q-icon(name='arrow_back', size='16px')
        span.q-ml-sm Назад
      q-space
      BaseButton(v-if='activeKey !== "review"', variant='primary', @click='goNext')
        span.q-mr-sm Далее
        q-icon(name='arrow_forward', size='16px')
      BaseButton(v-else, variant='primary', :loading='submitting', @click='onSubmit')
        q-icon(name='fa-solid fa-paper-plane', size='14px')
        span.q-ml-sm {{ submitLabel }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { QForm } from 'quasar';
import { Loading, Notify } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { fileToBase64 } from 'src/shared/lib/utils';
import { createOffer, fetchCategories, fetchMyOfferById, updateOffer } from '../api';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferFormState,
  MarketplaceCreateOfferPayload,
  MarketplaceOfferCycleType,
  MarketplaceOfferImageDraft,
  MarketplaceOfferImageUpload,
  MarketplaceOfferImageView,
  MarketplaceUnitOfMeasure,
} from '../types';

/**
 * Story 3.2 / 4.7: многошаговый мастер публикации Offer'а (по канону
 * MONO Design System, образец — features/Meet/CreateMeet/CreateMeetForm).
 * Шаги: Товар → Цена и наличие → Условия поставки → Изображения → Проверка.
 *
 * Изображения грузятся на backend как base64 в `images` мутации
 * marketplaceCreateOffer/UpdateOffer (тот же контракт, что и фото
 * гарантийного возврата). При редактировании загрузка новых изображений
 * полностью заменяет текущий набор; если файлы не выбраны — набор не трогается.
 */

const MAX_IMAGES = 8;
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const router = useRouter();
const route = useRoute();

// Правило цены вынесено из шаблона: regex в pug-атрибуте требует экранирования.
const priceRule = (v: string): true | string =>
  /^\d+(\.\d{1,4})?$/.test(v ?? '') || 'Цена должна быть числом, например 100.50';

const editId = computed(() => {
  const p = route.params.offerId;
  return typeof p === 'string' && p ? p : null;
});
const isEdit = computed(() => editId.value !== null);
const prefilling = ref(false);
const submitting = ref(false);

const pageTitle = computed(() => (isEdit.value ? 'Редактирование предложения' : 'Новое предложение'));
const submitLabel = computed(() =>
  isEdit.value ? 'Сохранить и отправить на модерацию' : 'Опубликовать на модерацию'
);

// ===== Шаги =====
const steps: StepperStep[] = [
  { key: 'basics', label: 'Товар', description: 'Название, категория, описание' },
  { key: 'pricing', label: 'Цена и наличие', description: 'Стоимость, количество, гарантия' },
  { key: 'supply', label: 'Условия поставки', description: 'Как набираются заказы' },
  { key: 'images', label: 'Изображения', description: 'Фотографии товара' },
  { key: 'review', label: 'Проверка и публикация', description: 'Сверьте карточку перед отправкой' },
];
const firstStepKey = steps[0].key;
const activeKey = ref<string>('basics');
const completedKeys = ref<string[]>([]);

const basicsForm = ref<QForm | null>(null);
const pricingForm = ref<QForm | null>(null);

// ===== Справочники / опции =====
const unitOptions: Array<{ label: string; value: MarketplaceUnitOfMeasure }> = [
  { label: 'шт.', value: 'piece' },
  { label: 'кг', value: 'kg' },
  { label: 'литр', value: 'liter' },
  { label: 'упак.', value: 'pack' },
];

const cycleTypeOptions: Array<{
  value: MarketplaceOfferCycleType;
  title: string;
  description: string;
}> = [
  {
    value: 'time_based',
    title: 'По расписанию',
    description: 'Поставка по истечении цикла; если набралось меньше порога — заказы отменятся.',
  },
  {
    value: 'volume_based',
    title: 'По объёму',
    description: 'Поставка стартует, когда наберётся нужный объём; иначе отменяется по сроку.',
  },
  {
    value: 'open_subscription',
    title: 'Открытая подписка',
    description: 'Вы сами запускаете поставку; заказчик может отменить, если ждёт дольше срока.',
  },
  {
    value: 'individual',
    title: 'Индивидуально',
    description: 'Каждый заказ принимается отдельно, без ожидания набора.',
  },
];

const categories = ref<MarketplaceCategoryView[]>([]);
const categoryOptions = computed(() =>
  categories.value
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ label: c.display_name, value: c.id }))
);

// ===== Форма =====
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

// ===== Изображения =====
const picked = ref<File[] | null>(null);
const imageDrafts = ref<MarketplaceOfferImageDraft[]>([]);
const existingImages = ref<MarketplaceOfferImageView[]>([]);

const isTimeBased = computed(() => form.value.cycle_type === 'time_based');
const isVolumeBased = computed(() => form.value.cycle_type === 'volume_based');
const isOpenSubscription = computed(() => form.value.cycle_type === 'open_subscription');

const selectedCategoryLabel = computed(
  () => categoryOptions.value.find((o) => o.value === form.value.category_id)?.label ?? '—'
);
const selectedUnitLabel = computed(
  () => unitOptions.find((o) => o.value === form.value.unit_of_measure)?.label ?? ''
);
const selectedCycleTitle = computed(
  () => cycleTypeOptions.find((o) => o.value === form.value.cycle_type)?.title ?? '—'
);
const reviewImagesLabel = computed(() => {
  if (imageDrafts.value.length) return `${imageDrafts.value.length} новых`;
  if (isEdit.value && existingImages.value.length) return `${existingImages.value.length} (без изменений)`;
  return 'нет';
});

function onSelectCycle(value: MarketplaceOfferCycleType): void {
  form.value.cycle_type = value;
  if (value === 'time_based') {
    form.value.target_volume = null;
    form.value.max_wait_days = null;
    if (!form.value.cycle_days) form.value.cycle_days = 7;
  } else if (value === 'volume_based') {
    form.value.cycle_days = null;
    form.value.min_threshold = null;
    if (!form.value.target_volume) form.value.target_volume = 100;
    if (!form.value.max_wait_days) form.value.max_wait_days = 30;
  } else if (value === 'open_subscription') {
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

async function onPickFiles(files: readonly File[] | null): Promise<void> {
  const list = files ? [...files] : [];
  // Берём только ещё не добавленные файлы (по имени) — на случай повторного выбора.
  const fresh = list.filter(
    (f) => !imageDrafts.value.some((d) => d.name === f.name && d.base64.length > 0)
  );
  for (const file of fresh) {
    if (imageDrafts.value.length >= MAX_IMAGES) {
      Notify.create({ type: 'warning', message: `Можно добавить не более ${MAX_IMAGES} изображений.` });
      break;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      Notify.create({ type: 'negative', message: `Файл «${file.name}»: поддерживаются только JPEG, PNG, WEBP.` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      Notify.create({ type: 'negative', message: `Файл «${file.name}» больше ${MAX_MB} МБ.` });
      continue;
    }
    const base64 = await fileToBase64(file);
    imageDrafts.value.push({
      preview_url: URL.createObjectURL(file),
      name: file.name,
      base64,
      mime_type: file.type,
    });
  }
  // q-file модель не храним — управляем своим списком превью.
  picked.value = null;
}

function removeImage(index: number): void {
  const [removed] = imageDrafts.value.splice(index, 1);
  if (removed) URL.revokeObjectURL(removed.preview_url);
}

// ===== Навигация =====
function markCompleted(key: string): void {
  if (!completedKeys.value.includes(key)) completedKeys.value.push(key);
}

function validateSupply(): string | null {
  const f = form.value;
  if (f.cycle_type === 'time_based') {
    if (!f.cycle_days || f.cycle_days < 1) return 'Укажите длительность цикла (от 1 дня).';
  }
  if (f.cycle_type === 'volume_based') {
    if (!f.target_volume || f.target_volume < 1) return 'Укажите целевой объём (от 1).';
    if (!f.max_wait_days || f.max_wait_days < 1) return 'Укажите максимальный срок ожидания (от 1 дня).';
  }
  return null;
}

async function goNext(): Promise<void> {
  if (activeKey.value === 'basics') {
    if (!(await basicsForm.value?.validate())) return;
    markCompleted('basics');
    activeKey.value = 'pricing';
    return;
  }
  if (activeKey.value === 'pricing') {
    if (!(await pricingForm.value?.validate())) return;
    markCompleted('pricing');
    activeKey.value = 'supply';
    return;
  }
  if (activeKey.value === 'supply') {
    const err = validateSupply();
    if (err) {
      Notify.create({ type: 'negative', message: err });
      return;
    }
    markCompleted('supply');
    activeKey.value = 'images';
    return;
  }
  if (activeKey.value === 'images') {
    markCompleted('images');
    activeKey.value = 'review';
  }
}

function goBack(): void {
  const order = steps.map((s) => s.key);
  const i = order.indexOf(activeKey.value);
  if (i > 0) activeKey.value = order[i - 1];
}

function goToStep(key: string): void {
  if (completedKeys.value.includes(key) || key === activeKey.value) activeKey.value = key;
}

function onCancel(): void {
  router.back();
}

// ===== Сабмит =====
function buildImagesPayload(): MarketplaceOfferImageUpload[] | undefined {
  const fresh = imageDrafts.value.map((d) => ({ base64: d.base64, mime_type: d.mime_type }));
  if (isEdit.value) {
    // В режиме правки изображения трогаем только если выбраны новые файлы.
    return fresh.length ? fresh : undefined;
  }
  return fresh;
}

async function onSubmit(): Promise<void> {
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
      f.cycle_type === 'volume_based' || f.cycle_type === 'open_subscription' ? f.max_wait_days : null,
    min_threshold: f.cycle_type === 'time_based' ? f.min_threshold : null,
    warranty_days: f.warranty_days,
    images: buildImagesPayload(),
  };

  submitting.value = true;
  Loading.show({ message: isEdit.value ? 'Сохраняю изменения…' : 'Создаю предложение…' });
  try {
    if (isEdit.value && editId.value) {
      await updateOffer({ id: editId.value, ...payload });
      Notify.create({
        type: 'positive',
        message: 'Изменения сохранены. Предложение отправлено на повторную модерацию.',
      });
      void router.push({ name: 'marketplace-my-offers' });
    } else {
      const result = await createOffer(payload);
      Notify.create({
        type: 'positive',
        message: `Предложение создано (id ${result.id.slice(0, 8)}), статус: ${result.status}.`,
      });
      void router.push({ name: 'marketplace-catalog' });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message, timeout: 6000 });
  } finally {
    Loading.hide();
    submitting.value = false;
  }
}

async function prefillForEdit(id: string): Promise<void> {
  prefilling.value = true;
  try {
    const offer = await fetchMyOfferById(id);
    if (!offer) {
      Notify.create({ type: 'negative', message: 'Предложение не найдено или вам не принадлежит.' });
      void router.push({ name: 'marketplace-my-offers' });
      return;
    }
    form.value = {
      product_name: offer.product_name,
      description: offer.description ?? '',
      category_id: offer.category_id != null ? Number(offer.category_id) : null,
      price_per_unit: offer.price_per_unit,
      unit_of_measure: offer.unit_of_measure as MarketplaceUnitOfMeasure,
      quantity_available: offer.quantity_available,
      unlimited_flag: offer.unlimited_flag,
      cycle_type: offer.cycle_type,
      cycle_days: offer.cycle_days,
      target_volume: offer.target_volume,
      max_wait_days: offer.max_wait_days,
      min_threshold: offer.min_threshold,
      warranty_days: offer.warranty_days,
    };
    existingImages.value = (offer.images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    prefilling.value = false;
  }
}

onMounted(async () => {
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  }
  if (editId.value) await prefillForEdit(editId.value);
});

onBeforeUnmount(() => {
  for (const d of imageDrafts.value) URL.revokeObjectURL(d.preview_url);
});
</script>

<style scoped lang="scss">
.offer-wizard {
  padding: var(--p-6, 24px) var(--p-4, 16px);

  &__col {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__title {
    margin: 0;
    font-size: var(--p-fs-h2, 24px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__intro {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body, 1.55);
    color: var(--p-ink-2);
  }

  &__notice {
    background: var(--p-warn-soft, #fff8e1);
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
    padding-bottom: var(--p-2, 8px);
  }

  &__row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__qty {
    display: flex;
    align-items: flex-start;
    gap: var(--p-4, 16px);
    flex-wrap: wrap;
  }

  &__field-label {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);

    &--sub {
      font-weight: 500;
      color: var(--p-ink-3);
    }
  }

  &__cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__conditional {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding-left: var(--p-3, 12px);
    border-left: 2px solid var(--p-line, #e0e0e0);
  }

  &__hint {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);

    &--muted {
      font-size: var(--p-fs-meta, 12px);
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__thumb {
    position: relative;
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    border: 1px solid var(--p-line, #e0e0e0);
  }

  &__img {
    width: 100%;
    border-radius: var(--p-r-md, 12px);
  }

  &__cover {
    position: absolute;
    top: var(--p-2, 8px);
    left: var(--p-2, 8px);
  }

  &__remove {
    position: absolute;
    top: var(--p-2, 8px);
    right: var(--p-2, 8px);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line, #e0e0e0);
  }
}

.offer-review {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-line, #e0e0e0);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;

  &__row {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: var(--p-3, 12px);
    padding: var(--p-3, 12px) var(--p-4, 16px);
    background: var(--p-surface, #fff);

    & + & {
      border-top: 1px solid var(--p-line, #e0e0e0);
    }
  }

  &__label {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-2);
  }

  &__value {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-1);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
}
</style>
