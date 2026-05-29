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
            dense,
            no-error-icon,
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
            dense,
            no-error-icon,
            reserve-hint-space,
            emit-value,
            map-options,
            :rules='[(v) => v !== null || "Выберите категорию"]'
          )
          q-input(
            v-model='form.description',
            label='Описание (необязательно)',
            outlined,
            dense,
            no-error-icon,
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
              dense,
              no-error-icon,
              reserve-hint-space,
              :suffix='governSymbol',
              hint='Два знака после запятой, например 100.50',
              :rules='[priceRule]'
            )
            q-select(
              v-model='form.unit_of_measure',
              :options='unitOptions',
              label='Единица измерения',
              outlined,
              dense,
              no-error-icon,
              reserve-hint-space,
              emit-value,
              map-options
            )
          .offer-wizard__qty
            q-input.offer-wizard__qty-input(
              v-model.number='form.quantity_available',
              label='Доступное количество',
              type='number',
              min='0',
              outlined,
              dense,
              no-error-icon,
              reserve-hint-space,
              :disable='form.unlimited_flag',
              :rules='[(v) => form.unlimited_flag || (v !== null && v >= 0) || "Укажите количество или включите «без ограничения»"]'
            )
            BaseCheckbox.offer-wizard__qty-check(
              :model-value='form.unlimited_flag',
              label='Без ограничения',
              @update:model-value='onToggleUnlimited'
            )
          q-input(
            v-model.number='form.warranty_days',
            label='Гарантия (дней)',
            type='number',
            min='0',
            outlined,
            dense,
            no-error-icon,
            reserve-hint-space,
            hint='0 — без гарантийного срока',
            :rules='[(v) => (v !== null && v >= 0) || "Срок гарантии не может быть отрицательным"]'
          )

        //- ───────── Шаг 3: Условия поставки ─────────
        .offer-wizard__step(v-else-if='step.key === "supply"')
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
              dense,
              no-error-icon,
              reserve-hint-space,
              hint='Поставка по истечении цикла'
            )
            q-input(
              v-model.number='form.min_threshold',
              label='Минимальный порог объёма (необязательно)',
              type='number',
              min='0',
              outlined,
              dense,
              no-error-icon,
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
              dense,
              no-error-icon,
              reserve-hint-space,
              hint='Поставка стартует, когда наберётся этот объём'
            )
            q-input(
              v-model.number='form.max_wait_days',
              label='Максимальный срок ожидания (дней)',
              type='number',
              min='1',
              outlined,
              dense,
              no-error-icon,
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
              dense,
              no-error-icon,
              reserve-hint-space,
              hint='После этого срока заказчик может отменить заказ сам'
            )
          .offer-wizard__hint(v-else)
            | Каждый заказ принимается индивидуально, без ожидания набора.

        //- ───────── Шаг 4: Изображения ─────────
        .offer-wizard__step(v-else-if='step.key === "images"')
          p.offer-wizard__hint
            | До {{ MAX_IMAGES }} изображений, каждое до {{ MAX_MB }} МБ (JPEG, PNG или WEBP).
            | Нажмите на снимок, чтобы сделать его обложкой карточки.

          .offer-wizard__existing(v-if='isEdit && existingImages.length && !imageDrafts.length')
            .offer-wizard__field-label.offer-wizard__field-label--sub Текущие изображения
            .offer-wizard__grid
              .offer-wizard__thumb(v-for='(img, i) in existingImages', :key='img.url')
                q-img.offer-wizard__img(:src='img.url', ratio='1')
                span.offer-wizard__cover(v-if='i === 0') Обложка
            p.offer-wizard__hint.offer-wizard__hint--muted
              | Загрузка новых изображений заменит текущие.

          .offer-wizard__grid(v-if='imageDrafts.length')
            .offer-wizard__thumb(
              v-for='(img, i) in imageDrafts',
              :key='img.preview_url',
              :class='{ "offer-wizard__thumb--cover": i === coverIndex }',
              :title='i === coverIndex ? "Это обложка" : "Сделать обложкой"',
              role='button',
              tabindex='0',
              @click='setCover(i)',
              @keydown.enter='setCover(i)'
            )
              q-img.offer-wizard__img(:src='img.preview_url', ratio='1')
              span.offer-wizard__cover(v-if='i === coverIndex') Обложка
              span.offer-wizard__set(v-else) Сделать обложкой
              q-btn.offer-wizard__remove(
                round,
                unelevated,
                size='sm',
                icon='close',
                color='negative',
                aria-label='Удалить изображение',
                @click.stop='removeImage(i)'
              )

          q-file(
            v-model='picked',
            label='Добавить изображения',
            outlined,
            dense,
            multiple,
            accept='image/jpeg,image/png,image/webp',
            :disable='imageDrafts.length >= MAX_IMAGES',
            @update:model-value='onPickFiles'
          )
            template(#prepend)
              q-icon(name='fa-solid fa-image')

        //- ───────── Шаг 5: Проверка (карточка-предпросмотр) ─────────
        .offer-wizard__step(v-else-if='step.key === "review"')
          p.offer-wizard__hint
            | Так предложение увидят заказчики в каталоге после одобрения модератором.

          article.offer-preview
            q-carousel.offer-preview__carousel(
              v-if='previewImages.length',
              v-model='previewActive',
              swipeable,
              animated,
              infinite,
              transition-prev='slide-right',
              transition-next='slide-left',
              :arrows='previewImages.length > 1',
              control-color='primary',
              height='320px'
            )
              q-carousel-slide(
                v-for='(img, i) in previewImages',
                :key='img.url',
                :name='i'
              )
                q-img.offer-preview__slideimg(:src='img.url', :ratio='1', fit='cover')
            .offer-preview__placeholder(v-else)
              q-icon(name='fa-solid fa-image', size='52px')
              span Без изображения

            .offer-preview__info
              header.offer-preview__head
                h2.offer-preview__name {{ form.product_name || 'Без названия' }}
                BaseChip(variant='neutral', size='sm') {{ selectedCategoryLabel }}
              .offer-preview__pricerow
                .offer-preview__pricebox
                  span.offer-preview__price {{ formattedPrice }}
                  span.offer-preview__per за {{ selectedUnitLabel }}
                BaseChip(:variant='stockEmpty ? "neg" : "pos"', size='sm') {{ stockLabel }}
              p.offer-preview__desc(v-if='form.description') {{ form.description }}
              section.offer-preview__specs
                .offer-preview__specs-title Характеристики
                dl.offer-preview__specs-list
                  .offer-preview__spec
                    dt Отсечка заказов
                    dd {{ selectedCycleTitle }}
                  .offer-preview__spec(v-if='isTimeBased && form.cycle_days')
                    dt Длительность цикла
                    dd {{ form.cycle_days }} дн.
                  .offer-preview__spec(v-if='isVolumeBased && form.target_volume')
                    dt Целевой объём
                    dd {{ form.target_volume }} {{ selectedUnitLabel }}
                  .offer-preview__spec(v-if='isVolumeBased && form.max_wait_days')
                    dt Срок ожидания
                    dd {{ form.max_wait_days }} дн.
                  .offer-preview__spec(v-if='form.warranty_days > 0')
                    dt Гарантия
                    dd {{ form.warranty_days }} дн.

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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { LocalStorage } from 'quasar';
import type { QForm } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { fileToBase64, formatAsset2Digits } from 'src/shared/lib/utils';
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
 * гарантийного возврата). Обложка карточки — изображение, выбранное
 * пайщиком (coverIndex); в payload оно ставится первым, backend трактует
 * sort_order=0 как обложку. При редактировании загрузка новых изображений
 * полностью заменяет текущий набор; если файлы не выбраны — набор не трогается.
 */

const MAX_IMAGES = 8;
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const router = useRouter();
const route = useRoute();

// Символ валюты — из системной инфо (блокчейн-параметр root_govern_symbol),
// НЕ хардкод «₽»: при смене символа цепи фронт не переписываем.
const systemStore = useSystemStore();
const governSymbol = computed(() => systemStore.governSymbol);

// Цена — целое или с двумя знаками после запятой (рубли/копейки). Допускаем
// и точку, и запятую при вводе; в payload нормализуем к точке. На цепь backend
// переводит в asset нужной precision сам (MARKETPLACE_ASSET_CONFIG).
// Regex вынесен из шаблона: в pug-атрибуте требует экранирования.
const priceRule = (v: string): true | string =>
  /^\d+([.,]\d{1,2})?$/.test((v ?? '').trim()) ||
  'Цена — число с двумя знаками после запятой, например 100.50';

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
  { key: 'supply', label: 'Условия поставки', description: 'Как набираются и отсекаются заказы' },
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
const coverIndex = ref(0);
const previewActive = ref(0);

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

// Нормализованная (точка-разделитель) цена для отправки и форматирования.
const priceNumberStr = computed(() => form.value.price_per_unit.trim().replace(',', '.'));
const formattedPrice = computed(() =>
  priceNumberStr.value ? formatAsset2Digits(`${priceNumberStr.value} ${governSymbol.value}`) : '—'
);

const stockEmpty = computed(
  () => !form.value.unlimited_flag && (form.value.quantity_available ?? 0) <= 0
);
const stockLabel = computed(() => {
  if (form.value.unlimited_flag) return 'В наличии';
  if (stockEmpty.value) return 'Нет в наличии';
  return `В наличии: ${form.value.quantity_available} ${selectedUnitLabel.value}`;
});

// ===== Черновик формы в LocalStorage (только режим создания) =====
// Изображения не сохраняем: object-URL'ы недействительны после перезагрузки,
// а base64 не влезает в LocalStorage. Восстанавливаем текстовые поля и шаг.
const DRAFT_KEY = 'marketplace:create-offer-draft';
// Бюджет на изображения в черновике (суммарная длина base64). LocalStorage —
// ~5 МБ на origin; свыше бюджета черновик сохраняем БЕЗ картинок (поля важнее).
const MAX_DRAFT_IMAGE_CHARS = 2_000_000;

interface OfferDraftImage {
  base64: string;
  mime_type: string;
  name: string;
}
interface OfferDraft {
  form: MarketplaceCreateOfferFormState;
  activeKey: string;
  completedKeys: string[];
  coverIndex: number;
  images?: OfferDraftImage[];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveDraft(): void {
  if (isEdit.value) return;
  const base: OfferDraft = {
    form: form.value,
    activeKey: activeKey.value,
    completedKeys: completedKeys.value,
    coverIndex: coverIndex.value,
  };
  const images: OfferDraftImage[] = imageDrafts.value.map((d) => ({
    base64: d.base64,
    mime_type: d.mime_type,
    name: d.name,
  }));
  const totalChars = images.reduce((n, im) => n + im.base64.length, 0);
  const payload: OfferDraft =
    images.length && totalChars <= MAX_DRAFT_IMAGE_CHARS ? { ...base, images } : base;
  try {
    LocalStorage.set(DRAFT_KEY, payload);
  } catch {
    // QuotaExceeded — сохраняем без изображений, чтобы не потерять поля.
    try {
      LocalStorage.set(DRAFT_KEY, base);
    } catch {
      /* LocalStorage недоступен — игнорируем */
    }
  }
}

function scheduleSaveDraft(): void {
  if (isEdit.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  // Дебаунс: не сериализуем base64-картинки на каждое нажатие клавиши.
  saveTimer = setTimeout(saveDraft, 400);
}

function restoreDraft(): void {
  const saved = LocalStorage.getItem(DRAFT_KEY) as Partial<OfferDraft> | null;
  if (!saved?.form) return;
  form.value = { ...form.value, ...saved.form };
  if (typeof saved.activeKey === 'string') activeKey.value = saved.activeKey;
  if (Array.isArray(saved.completedKeys)) completedKeys.value = saved.completedKeys;
  if (Array.isArray(saved.images) && saved.images.length) {
    // object-URL после reload мёртв — превью восстанавливаем как data-URL из base64.
    imageDrafts.value = saved.images.map((im) => ({
      preview_url: `data:${im.mime_type};base64,${im.base64}`,
      name: im.name,
      base64: im.base64,
      mime_type: im.mime_type,
    }));
  }
  if (typeof saved.coverIndex === 'number') coverIndex.value = saved.coverIndex;
}

function clearDraft(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  LocalStorage.remove(DRAFT_KEY);
}

// Черновики в порядке «обложка первой» — для payload и предпросмотра.
function draftsCoverFirst(): MarketplaceOfferImageDraft[] {
  const arr = imageDrafts.value;
  if (!arr.length) return [];
  const ci = Math.min(Math.max(coverIndex.value, 0), arr.length - 1);
  return [arr[ci], ...arr.filter((_, i) => i !== ci)];
}

const previewImages = computed<Array<{ url: string }>>(() => {
  if (imageDrafts.value.length) {
    return draftsCoverFirst().map((d) => ({ url: d.preview_url }));
  }
  if (isEdit.value && existingImages.value.length) {
    return existingImages.value.map((img) => ({ url: img.url }));
  }
  return [];
});

function onToggleUnlimited(value: boolean): void {
  form.value.unlimited_flag = value;
}

function setCover(index: number): void {
  coverIndex.value = index;
}

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
      FailAlert(new Error(`Можно добавить не более ${MAX_IMAGES} изображений.`));
      break;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      FailAlert(new Error(`Файл «${file.name}»: поддерживаются только JPEG, PNG, WEBP.`));
      continue;
    }
    if (file.size > MAX_BYTES) {
      FailAlert(new Error(`Файл «${file.name}» больше ${MAX_MB} МБ.`));
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
  // Сдвигаем выбор обложки, чтобы он не «уехал» на чужой снимок.
  if (index === coverIndex.value) coverIndex.value = 0;
  else if (index < coverIndex.value) coverIndex.value -= 1;
  if (coverIndex.value > imageDrafts.value.length - 1) {
    coverIndex.value = Math.max(0, imageDrafts.value.length - 1);
  }
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
      FailAlert(new Error(err));
      return;
    }
    markCompleted('supply');
    activeKey.value = 'images';
    return;
  }
  if (activeKey.value === 'images') {
    markCompleted('images');
    previewActive.value = 0;
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
  const fresh = draftsCoverFirst().map((d) => ({ base64: d.base64, mime_type: d.mime_type }));
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
    price_per_unit: priceNumberStr.value,
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
  try {
    if (isEdit.value && editId.value) {
      await updateOffer({ id: editId.value, ...payload });
      SuccessAlert('Изменения сохранены. Предложение отправлено на повторную модерацию.');
      void router.push({ name: 'marketplace-my-offers' });
    } else {
      const result = await createOffer(payload);
      clearDraft();
      SuccessAlert(`Предложение создано (id ${result.id.slice(0, 8)}), статус: ${result.status}.`);
      void router.push({ name: 'marketplace-catalog' });
    }
  } catch (e) {
    FailAlert(e, isEdit.value ? 'Не удалось сохранить предложение' : 'Не удалось создать предложение');
  } finally {
    submitting.value = false;
  }
}

async function prefillForEdit(id: string): Promise<void> {
  prefilling.value = true;
  try {
    const offer = await fetchMyOfferById(id);
    if (!offer) {
      FailAlert(new Error('Предложение не найдено или вам не принадлежит.'));
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
    FailAlert(e, 'Не удалось загрузить предложение');
  } finally {
    prefilling.value = false;
  }
}

onMounted(async () => {
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить категории');
  }
  if (editId.value) {
    await prefillForEdit(editId.value);
  } else {
    // Восстанавливаем черновик и подключаем автосохранение (клиент-only).
    restoreDraft();
    watch([form, activeKey, completedKeys, imageDrafts, coverIndex], scheduleSaveDraft, {
      deep: true,
    });
  }
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
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
    gap: var(--p-3, 12px);
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

  &__qty-input {
    flex: 0 1 240px;
  }

  // Чекбокс в одной строке с полем количества; небольшой top-отступ
  // выравнивает его по центру dense-контрола.
  &__qty-check {
    margin-top: var(--p-2, 8px);
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
    border: 2px solid var(--p-line, #e0e0e0);
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--p-accent-soft, rgba(99, 102, 241, 0.35));
    }

    &--cover {
      border-color: var(--p-accent, #6366f1);
      box-shadow: 0 0 0 1px var(--p-accent, #6366f1);
    }
  }

  &__img {
    width: 100%;
    border-radius: 0;
    display: block;
  }

  // Непрозрачный бейдж обложки — читается на любом фоне снимка.
  &__cover {
    position: absolute;
    top: var(--p-2, 8px);
    left: var(--p-2, 8px);
    padding: 2px 8px;
    border-radius: var(--p-r-sm, 6px);
    background: var(--p-accent, #6366f1);
    color: #fff;
    font-size: var(--p-fs-meta, 12px);
    font-weight: 600;
    line-height: 1.4;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }

  // Подсказка на не-обложке: видна только при наведении.
  &__set {
    position: absolute;
    bottom: var(--p-2, 8px);
    left: var(--p-2, 8px);
    right: var(--p-2, 8px);
    padding: 2px 8px;
    border-radius: var(--p-r-sm, 6px);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: var(--p-fs-meta, 12px);
    text-align: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &__thumb:hover &__set {
    opacity: 1;
  }

  &__remove {
    position: absolute;
    top: var(--p-2, 8px);
    right: var(--p-2, 8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line, #e0e0e0);
  }
}

// Карточка-предпросмотр на шаге «Проверка» — приближённый вид каталога.
.offer-preview {
  border: 1px solid var(--p-line, #e0e0e0);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
  background: var(--p-surface, #fff);
  max-width: 420px;
  box-shadow: var(--p-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.08));

  &__carousel {
    width: 100%;
    background: var(--p-surface-2, #f5f5f5);

    // Изображение во всю ширину — убираем дефолтный padding слайда q-carousel.
    :deep(.q-carousel__slide) {
      padding: 0;
    }
  }

  &__slideimg {
    width: 100%;
    height: 100%;
  }

  &__placeholder {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
    background: var(--p-surface-2, #f5f5f5);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding: var(--p-4, 16px);
  }

  &__head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--p-2, 8px);
  }

  &__name {
    margin: 0;
    font-size: var(--p-fs-h3, 20px);
    font-weight: 600;
    line-height: 1.3;
    color: var(--p-ink);
  }

  // Цена и наличие — в одну строку: цена слева крупно, наличие чипом справа.
  &__pricerow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__pricebox {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  &__price {
    font-size: var(--p-fs-h2, 24px);
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--p-ink);
  }

  &__per {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__desc {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body, 1.55);
    color: var(--p-ink-2);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  // Характеристики — отдельный блок с разделителем сверху и аккуратными строками.
  &__specs {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line, #e0e0e0);
  }

  &__specs-title {
    font-size: var(--p-fs-eyebrow, 11px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
  }

  &__specs-list {
    display: flex;
    flex-direction: column;
    margin: 0;
  }

  &__spec {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: 6px 0;

    & + & {
      border-top: 1px solid var(--p-line, #e0e0e0);
    }

    dt {
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink-3);
    }

    dd {
      margin: 0;
      font-size: var(--p-fs-body-sm, 13px);
      font-weight: 500;
      text-align: right;
      color: var(--p-ink-1, var(--p-ink));
    }
  }
}
</style>
