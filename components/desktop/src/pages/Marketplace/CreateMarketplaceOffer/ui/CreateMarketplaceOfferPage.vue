<template lang="pug">
q-page.mp-role-offerer.offer-wizard(role='region', aria-label='Создание предложения')
  .offer-wizard__col
    //- Заголовок страницы — в топбаре (route.meta.title), на странице не
    //- дублируется. Верхняя строка режима редактирования: статус слева,
    //- операционное действие (снять с публикации) — в правом углу.
    .offer-wizard__manage(v-if='isEdit && currentStatus')
      BaseChip(:variant='statusVariant', size='lg') {{ statusLabel }}
      q-space
      BaseButton(
        v-if='canWithdraw',
        variant='danger',
        :loading='withdrawing',
        @click='onWithdraw'
      )
        q-icon(name='visibility_off', size='16px')
        span.q-ml-sm Снять с публикации
      BaseButton(
        v-else-if='canRepublish',
        variant='primary',
        :loading='republishing',
        :disabled='payoutBlocked',
        @click='onRepublish'
      )
        q-icon(name='publish', size='16px')
        span.q-ml-sm Опубликовать снова

    //- Отклонённая оферта: показываем причину председателя. Поставщик правит
    //- карточку и переотправляет — пересоздавать заново не нужно.
    .banner.banner--neg(v-if='isEdit && currentStatus === "REJECTED"')
      q-icon.banner__icon(name='cancel', size='18px')
      .banner__body
        .text-weight-medium Предложение отклонено модератором
        .q-mt-xs(v-if='rejectReason') Причина: {{ rejectReason }}
        .q-mt-xs Исправьте указанное и нажмите «Отправить на модерацию» — оферта уйдёт на повторную проверку с тем же содержимым.

    //- Гейт публикации: предложение нельзя опубликовать без реквизитов для
    //- выплат (backend отклонит) — объясняем и ведём в настройку.
    .banner.banner--warn(v-if='payoutBlocked')
      q-icon.banner__icon(name='warning_amber', size='18px')
      .banner__body
        .text-weight-medium Укажите реквизиты для выплат
        .q-mt-xs Выплаты по актам приёмки приходят на ваши реквизиты. Пока они не указаны, опубликовать предложение нельзя.
        BaseButton.q-mt-sm(variant='primary', size='sm', @click='goToPayouts')
          q-icon(name='payments', size='16px')
          span.q-ml-sm Указать реквизиты

    //- Канон-подсказка (одна на страницу, закрывается крестиком): заполнение +
    //- правила модерации. Для отклонённой показываем баннер причины выше — этот
    //- не дублируем.
    PageHint(v-if='currentStatus !== "REJECTED"', storage-key='mp:offer-wizard:banner-dismissed')
      | {{ infoText }}

    //- Скелетон формы на время дозагрузки оферты в режиме редактирования:
    //- степпер монтируем только когда данные готовы, чтобы поля не
    //- «дозаполнялись» на глазах (без дёргания). В режиме создания prefilling
    //- всегда false — степпер рендерится сразу.
    .offer-wizard__skel(v-if='prefilling')
      .skel.skel--title.offer-wizard__skel-title
      .skel.skel--text.offer-wizard__skel-line
      .skel.skel--text.offer-wizard__skel-line.offer-wizard__skel-line--wide
      .skel.skel--text.offer-wizard__skel-line.offer-wizard__skel-line--narrow
      .skel.skel--text.offer-wizard__skel-line

    VerticalStepper(
      v-else,
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
            q-select(
              v-model='form.unit_of_measure',
              :options='unitOptions',
              label='Единица измерения',
              outlined,
              dense,
              no-error-icon,
              emit-value,
              map-options
            )
            q-input(
              v-if='form.sale_form !== "packaged"',
              v-model='form.price_per_unit',
              :label='priceLabel',
              outlined,
              dense,
              no-error-icon,
              :suffix='governSymbol',
              :rules='[priceRule]'
            )

          //- ───────── Способ отпуска (Эпик 18) ─────────
          .offer-wizard__qty-group
            .offer-wizard__field-label Способ отпуска
            .offer-wizard__qty-mode
              button.offer-wizard__qty-mode-label(
                type='button',
                :class='{ "offer-wizard__qty-mode-label--active": form.sale_form === "by_measure" }',
                @click='onSelectSaleForm("by_measure")'
              ) По мере
              q-toggle.offer-wizard__qty-toggle(
                :model-value='form.sale_form === "packaged"',
                color='primary',
                dense,
                aria-label='По мере или упаковкой',
                @update:model-value='(v) => onSelectSaleForm(v ? "packaged" : "by_measure")'
              )
              button.offer-wizard__qty-mode-label(
                type='button',
                :class='{ "offer-wizard__qty-mode-label--active": form.sale_form === "packaged" }',
                @click='onSelectSaleForm("packaged")'
              ) Упаковкой
            .offer-wizard__hint(v-if='form.sale_form === "by_measure"') Заказчик указывает произвольное количество; цена — за {{ orderUnitLabel }}.
            .offer-wizard__hint(v-else) Товар отпускается целыми упаковками, у каждой своя цена. Заказчик выбирает упаковку и число упаковок.

          //- ───────── Редактор упаковок ─────────
          .offer-wizard__packages(v-if='form.sale_form === "packaged"')
            .offer-wizard__pkg-row(v-for='(pkg, i) in form.packages', :key='i')
              q-input.offer-wizard__pkg-size(
                v-model.number='pkg.size',
                :label='`Содержимое, ${orderUnitLabel}`',
                type='number',
                min='0',
                :step='unitStep',
                outlined,
                dense,
                no-error-icon,
                hide-bottom-space
              )
              q-input.offer-wizard__pkg-price(
                v-model='pkg.price',
                label='Цена упаковки',
                outlined,
                dense,
                no-error-icon,
                hide-bottom-space,
                :suffix='governSymbol'
              )
              q-input.offer-wizard__pkg-label(
                v-model='pkg.label',
                label='Подпись (необяз.)',
                outlined,
                dense,
                no-error-icon,
                hide-bottom-space
              )
              q-radio(
                :model-value='defaultPackageIndex',
                :val='i',
                color='primary',
                label='По умолч.',
                @update:model-value='setDefaultPackage(i)'
              )
              q-btn(
                flat,
                round,
                dense,
                icon='delete_outline',
                :disable='form.packages.length <= 1',
                aria-label='Убрать упаковку',
                @click='removePackage(i)'
              )
            q-btn.offer-wizard__pkg-add(
              flat,
              dense,
              icon='add',
              label='Добавить упаковку',
              color='primary',
              @click='addPackage'
            )

          .offer-wizard__qty-group
            .offer-wizard__field-label Наличие
            .offer-wizard__qty-mode
              button.offer-wizard__qty-mode-label(
                type='button',
                :class='{ "offer-wizard__qty-mode-label--active": !form.unlimited_flag }',
                @click='onToggleUnlimited(false)'
              ) Количество ограничено
              q-toggle.offer-wizard__qty-toggle(
                :model-value='form.unlimited_flag',
                color='primary',
                dense,
                aria-label='Количество ограничено или не ограничено',
                @update:model-value='onToggleUnlimited'
              )
              button.offer-wizard__qty-mode-label(
                type='button',
                :class='{ "offer-wizard__qty-mode-label--active": form.unlimited_flag }',
                @click='onToggleUnlimited(true)'
              ) Количество не ограничено
            q-input.offer-wizard__qty-input(
              v-model.number='form.quantity_available',
              label='Доступное количество',
              type='number',
              min='0',
              outlined,
              dense,
              no-error-icon,
              hide-bottom-space,
              :suffix='form.unlimited_flag ? undefined : `× ${orderUnitLabel}`',
              :disable='form.unlimited_flag',
              :rules='[(v) => form.unlimited_flag || (v !== null && v >= 0) || "Укажите количество или выберите «Количество не ограничено»"]'
            )
          q-input.offer-wizard__field-full(
            v-model.number='form.shelf_life_days',
            label='Срок годности (дней)',
            type='number',
            min='0',
            outlined,
            dense,
            no-error-icon,
            hide-bottom-space,
            :rules='[(v) => (v !== null && v >= 0) || "Срок годности не может быть отрицательным"]'
          )

        //- ───────── Шаг 3: КУ поставки и минимальный объём ─────────
        .offer-wizard__step(v-else-if='step.key === "supply"')
          p.offer-wizard__hint
            | Отметьте кооперативные участки, на которые готовы обеспечить доставку, и укажите объём поставки на каждое.
          .offer-wizard__hint(v-if='kuLoading') Загрузка участков…
          .offer-wizard__hint(v-else-if='!kuOptions.length') Нет доступных кооперативных участков.
          .offer-wizard__ku-row(v-for='ku in kuOptions', :key='ku.braname')
            BaseCheckbox(
              :model-value='isKuSelected(ku.braname)',
              @update:model-value='(v) => toggleKu(ku.braname, v)'
            )
              .offer-wizard__ku-label
                .offer-wizard__ku-name {{ ku.name }}
                .offer-wizard__ku-addr {{ ku.address }}
            BaseButton(
              v-if='kuHasCoords(ku)',
              variant='ghost',
              icon-only,
              size='sm',
              aria-label='Открыть карту',
              @click='openKuMap(ku)'
            )
              template(#icon-left)
                q-icon(name='map', size='18px')
            q-input.offer-wizard__ku-min(
              v-if='isKuSelected(ku.braname)',
              :model-value='kuMinVolume(ku.braname)',
              label='Мин. объём',
              type='number',
              min='1',
              outlined,
              dense,
              no-error-icon,
              :suffix='orderUnitLabel',
              @update:model-value='(v) => setKuMin(ku.braname, v)'
            )

        //- ───────── Шаг 4: Изображения ─────────
        .offer-wizard__step(v-else-if='step.key === "images"')
          p.offer-wizard__hint
            | До {{ MAX_IMAGES }} изображений, каждое до {{ MAX_MB }} МБ (JPEG, PNG или WEBP).
            | Нажмите на снимок, чтобы сделать его обложкой карточки; крестик — удалить.

          .offer-wizard__grid(v-if='gallery.length')
            .offer-wizard__thumb(
              v-for='(img, i) in gallery',
              :key='img.uid',
              :class='{ "offer-wizard__thumb--cover": i === coverIndex }',
              :title='i === coverIndex ? "Это обложка" : "Сделать обложкой"',
              role='button',
              tabindex='0',
              @click='setCover(i)',
              @keydown.enter='setCover(i)'
            )
              q-img.offer-wizard__img(:src='img.url', ratio='1')
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
            :disable='gallery.length >= MAX_IMAGES',
            @update:model-value='onPickFiles'
          )
            template(#prepend)
              q-icon(name='image')

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
                  span.offer-preview__per за {{ orderUnitLabel }}
                BaseChip(:variant='stockEmpty ? "neg" : "pos"', size='sm') {{ stockLabel }}
              p.offer-preview__fee(v-if='priceWithFeeHint') {{ priceWithFeeHint }}
              p.offer-preview__desc(v-if='form.description') {{ form.description }}
              section.offer-preview__specs
                .offer-preview__specs-title Характеристики
                dl.offer-preview__specs-list
                  .offer-preview__spec(v-if='form.delivery_points.length')
                    dt Участки поставки
                    dd {{ deliveryPointsPreview }}
                  .offer-preview__spec(v-if='form.shelf_life_days > 0')
                    dt Срок годности
                    dd {{ form.shelf_life_days }} дн.

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
      BaseButton(
        v-else,
        variant='primary',
        :loading='submitting',
        :disabled='payoutBlocked && !isEdit',
        @click='onSubmit'
      )
        q-icon(name='send', size='16px')
        span.q-ml-sm {{ submitLabel }}

  //- Всплывашка карты участка (точка по координатам геокодера).
  BaseDialog(v-model='mapOpen', :title='mapTitle', size='lg')
    .offer-wizard__map(v-if='mapKu && mapKu.lat != null && mapKu.lng != null')
      .offer-wizard__map-addr {{ mapKu.address }}
      MapView(:long='Number(mapKu.lng)', :lat='Number(mapKu.lat)')
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Dialog, LocalStorage } from 'quasar';
import type { QForm } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { PageHint } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Map as MapView } from 'src/shared/ui/Map';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceKUDetailsStore, GeocodeStatus } from 'src/entities/MarketplaceKUDetails';
import { MARKETPLACE_UNIT_OPTIONS, marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { fileToBase64, formatAsset2Digits } from 'src/shared/lib/utils';
import { applyMembershipFee, getMembershipFeePercent } from 'src/shared/lib/marketplace';
import { Zeus } from '@coopenomics/sdk';
import { republishOffer, withdrawOffer } from 'src/entities/MarketplaceOffer';
import {
  loadSupplierPaymentSettings,
  type MarketplaceSupplierPaymentSettingsView,
} from 'src/entities/MarketplaceSupplierSettings';
import {
  createOffer,
  fetchCategories,
  fetchMyOfferById,
  updateOffer,
} from '../api';
import type {
  MarketplaceCategoryView,
  MarketplaceCreateOfferFormState,
  MarketplaceCreateOfferPayload,
  MarketplaceOfferImageUpload,
  MarketplaceSaleForm,
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
const kuStore = useMarketplaceKUDetailsStore();
const governSymbol = computed(() => systemStore.governSymbol);

// Ставка членского взноса — поставщик должен видеть цену, которую реально
// заплатит заказчик (requirement: цена с взносом только на столе поставщика
// и администратора, не в самом каталоге заказчика).
const feePercent = ref(0);

// Цена — целое или с двумя знаками после запятой (рубли/копейки). Допускаем
// и точку, и запятую при вводе; в payload нормализуем к точке. На цепь backend
// переводит в asset нужной precision сам (MARKETPLACE_ASSET_CONFIG).
// Regex вынесен из шаблона: в pug-атрибуте требует экранирования.
const priceRule = (v: string): true | string =>
  /^\d+([.,]\d{1,2})?$/.test((v ?? '').trim()) ||
  'Цена — число с двумя знаками после запятой, например 100.50';

// Цена из БД приходит с большей точностью (напр. «100.0000») и не проходит
// priceRule. При prefill приводим к виду поля ввода — 2 знака после точки.
function formatPriceForInput(raw: string | number | null | undefined): string {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

const editId = computed(() => {
  const p = route.params.offerId;
  return typeof p === 'string' && p ? p : null;
});
const isEdit = computed(() => editId.value !== null);
const prefilling = ref(false);
const submitting = ref(false);

// Гейт публикации: без реквизитов для выплат backend отклонит публикацию —
// предупреждаем заранее и блокируем кнопки. Пока настройки не загрузились
// (null) — не блокируем, чтобы форма не мигала.
const payoutSettings = ref<MarketplaceSupplierPaymentSettingsView | null>(null);
const payoutBlocked = computed(
  () => payoutSettings.value !== null && !payoutSettings.value.has_payout_method,
);

function goToPayouts(): void {
  void router.push({
    name: 'marketplace-payments',
    params: { coopname: systemStore.info?.coopname },
  });
}

// Единая карточка-подсказка: при создании — про публикацию и модерацию; при
// правке снятой — что она остаётся снятой до возврата на публикацию; при правке
// прочих — что цена/остаток применяются сразу, а контент уходит на модерацию.
const infoText = computed(() => {
  if (!isEdit.value) {
    return 'Заполните карточку товара по шагам. После публикации предложение уходит на модерацию председателю — до одобрения оно не появится в каталоге.';
  }
  if (currentStatus.value === 'WITHDRAWN') {
    return 'Доработайте карточку снятого предложения. Пока вы не вернёте его на публикацию, оно остаётся снятым и в каталоге не показывается. При возврате изменённое содержимое снова пройдёт модерацию, неизменное — опубликуется сразу.';
  }
  return 'Заполните карточку товара по шагам. Цена и количество применяются сразу. Изменение названия, описания, категории, единицы измерения или фотографий снова отправит предложение на модерацию — до одобрения оно будет недоступно в каталоге.';
});
const submitLabel = computed(() => {
  if (!isEdit.value) return 'Опубликовать на модерацию';
  // Отклонённую правят, чтобы переотправить — подпись честно говорит, что
  // сохранение снова отправит оферту на модерацию.
  if (currentStatus.value === 'REJECTED') return 'Отправить на модерацию';
  return 'Сохранить изменения';
});

// ===== Управление офертой (только режим редактирования) =====
// Текущий статус оферты + операционные действия (снять / запустить поставку)
// живут на самой странице редактирования — отдельного диалога-просмотра нет.
type OfferStatus = 'PENDING_MODERATION' | 'ACTIVE' | 'REJECTED' | 'WITHDRAWN';
const currentStatus = ref<OfferStatus | null>(null);
const rejectReason = ref<string | null>(null);
const withdrawing = ref(false);

const STATUS_META: Record<OfferStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' }> = {
  PENDING_MODERATION: { label: 'На модерации', variant: 'warn' },
  ACTIVE: { label: 'Опубликовано', variant: 'pos' },
  REJECTED: { label: 'Отклонено', variant: 'neg' },
  WITHDRAWN: { label: 'Снято', variant: 'neutral' },
};
const statusLabel = computed(() => (currentStatus.value ? STATUS_META[currentStatus.value].label : ''));
const statusVariant = computed(() =>
  currentStatus.value ? STATUS_META[currentStatus.value].variant : 'neutral'
);
// Снять можно опубликованную или ожидающую модерации.
const canWithdraw = computed(
  () => currentStatus.value === 'PENDING_MODERATION' || currentStatus.value === 'ACTIVE'
);
// Вернуть на публикацию — только снятую. На этих столах кнопки взаимоисключающие:
// видно либо «Снять с публикации», либо «Опубликовать снова».
const canRepublish = computed(() => currentStatus.value === 'WITHDRAWN');
const republishing = ref(false);

function onRepublish(): void {
  if (!editId.value) return;
  republishing.value = true;
  void (async () => {
    try {
      const status = await republishOffer(editId.value as string);
      SuccessAlert(
        status === Zeus.MarketplaceOfferStatus.ACTIVE
          ? 'Предложение снова опубликовано.'
          : 'Предложение отправлено на модерацию.',
      );
      void router.push({ name: 'marketplace-my-offers' });
    } catch (e) {
      FailAlert(e, 'Не удалось вернуть предложение на публикацию');
    } finally {
      republishing.value = false;
    }
  })();
}

function onWithdraw(): void {
  if (!editId.value) return;
  Dialog.create({
    title: 'Снять предложение с публикации?',
    message:
      'Предложение перестанет показываться в каталоге и не будет принимать новые ' +
      'заказы. Вернуть его на публикацию можно в любой момент кнопкой ' +
      '«Опубликовать снова» — без повторной модерации, если не менять содержимое.',
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Снять с публикации', color: 'negative', unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(async () => {
    withdrawing.value = true;
    try {
      await withdrawOffer(editId.value as string);
      SuccessAlert('Предложение снято с публикации.');
      void router.push({ name: 'marketplace-my-offers' });
    } catch (e) {
      FailAlert(e, 'Не удалось снять предложение');
    } finally {
      withdrawing.value = false;
    }
  });
}

// ===== Шаги =====
const steps: StepperStep[] = [
  { key: 'basics', label: 'Товар', description: 'Название, категория, описание' },
  { key: 'pricing', label: 'Цена и наличие', description: 'Стоимость, количество, срок годности' },
  { key: 'supply', label: 'Условия поставки', description: 'Участки и объём поставки' },
  { key: 'images', label: 'Изображения', description: 'Фотографии товара' },
  { key: 'review', label: 'Проверка и публикация', description: 'Сверьте карточку перед отправкой' },
];
const firstStepKey = steps[0].key;
const activeKey = ref<string>('basics');
const completedKeys = ref<string[]>([]);

const basicsForm = ref<QForm | null>(null);
const pricingForm = ref<QForm | null>(null);

// ===== Справочники / опции =====
// Единицы измерения — общий канон-справочник (src/shared/lib/consts), чтобы
// подписи не расходились между созданием оферты, модерацией и «Мои предложения».
const unitOptions = MARKETPLACE_UNIT_OPTIONS;

// ===== КУ поставки (Эпик 15) =====
// Список кооперативных участков кооператива для чекбоксов: поставщик отмечает,
// на какие КУ готов везти, и ставит min-объём на каждый.
interface KuOption {
  braname: string;
  // Человеческое наименование участка (short_name/full_name филиала), НЕ служебный код.
  name: string;
  address: string;
  // Координаты геокодера (только при geocodeStatus OK) — для кнопки карты.
  lat: number | null;
  lng: number | null;
}
const kuOptions = ref<KuOption[]>([]);
const kuLoading = ref(false);

// Карта участка — всплывашка с точкой по координатам геокодера (как в админке ПВЗ).
const mapOpen = ref(false);
const mapKu = ref<KuOption | null>(null);
const mapTitle = computed(() => (mapKu.value ? `Карта — ${mapKu.value.name}` : 'Карта'));
function kuHasCoords(ku: KuOption): boolean {
  return ku.lat != null && ku.lng != null;
}
function openKuMap(ku: KuOption): void {
  mapKu.value = ku;
  mapOpen.value = true;
}

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
  sale_form: 'by_measure',
  packages: [],
  quantity_available: 1,
  unlimited_flag: false,
  delivery_points: [],
  shelf_life_days: 0,
});

// ===== Изображения =====
// Единая галерея: и уже сохранённые (bucket_key + подписанный url), и новые
// (base64 + object-url). Обложку, удаление и добавление можно применять к любому
// элементу с самого начала — без обязательной загрузки нового файла.
interface GalleryImage {
  uid: string;
  url: string;
  mime_type: string;
  /** Существующее изображение (сохраняем по ключу). */
  bucket_key?: string;
  /** Новый файл. */
  base64?: string;
  name?: string;
}

const picked = ref<File[] | null>(null);
const gallery = ref<GalleryImage[]>([]);
const coverIndex = ref(0);
const previewActive = ref(0);
// Ключи исходного набора (в исходном порядке) — чтобы при сохранении понять,
// менялись ли изображения, и не гнать оффер на повторную модерацию зря.
const originalImageKeys = ref<string[]>([]);
let galleryUidSeq = 0;

const selectedCategoryLabel = computed(
  () => categoryOptions.value.find((o) => o.value === form.value.category_id)?.label ?? '—'
);
// Подпись базовой единицы измерения: «кг», «л», «шт» (Эпик 17: количество и
// цена ведутся прямо в базовой единице, «фасовки» нет).
const orderUnitLabel = computed(() => marketplaceOrderUnitLabel(form.value.unit_of_measure));
const priceLabel = computed(() => `Цена за ${orderUnitLabel.value}`);

// Эпик 18: шаг ввода содержимого упаковки — штука неделима (1), вес/объём дробный.
const unitStep = computed(() => (form.value.unit_of_measure === 'piece' ? 1 : 0.001));

// Индекс упаковки «по умолчанию» (для radio); -1 если не задана.
const defaultPackageIndex = computed(() => form.value.packages.findIndex((p) => p.is_default));

function setDefaultPackage(index: number): void {
  form.value.packages.forEach((p, i) => {
    p.is_default = i === index;
  });
}

function addPackage(): void {
  const isFirst = form.value.packages.length === 0;
  form.value.packages.push({ size: null, price: '', label: '', is_default: isFirst });
}

function removePackage(index: number): void {
  const wasDefault = form.value.packages[index]?.is_default;
  form.value.packages.splice(index, 1);
  if (wasDefault && form.value.packages.length > 0) {
    form.value.packages[0].is_default = true;
  }
}

// Переключение способа отпуска: при первом переходе к «упаковкой» заводим
// одну пустую упаковку, чтобы редактор не был пустым.
function onSelectSaleForm(form_value: 'by_measure' | 'packaged'): void {
  form.value.sale_form = form_value;
  if (form_value === 'packaged' && form.value.packages.length === 0) {
    addPackage();
  }
}
const deliveryPointsPreview = computed(() =>
  form.value.delivery_points
    .map((d) => {
      const name = kuOptions.value.find((k) => k.braname === d.braname)?.name ?? d.braname;
      return `${name} (от ${d.min_supply_volume} ${orderUnitLabel.value})`;
    })
    .join(', ')
);

// ===== КУ-хелперы =====
function isKuSelected(braname: string): boolean {
  return form.value.delivery_points.some((d) => d.braname === braname);
}
function toggleKu(braname: string, checked: boolean): void {
  if (checked) {
    if (!isKuSelected(braname)) {
      form.value.delivery_points = [
        ...form.value.delivery_points,
        { braname, min_supply_volume: 1 },
      ];
    }
  } else {
    form.value.delivery_points = form.value.delivery_points.filter((d) => d.braname !== braname);
  }
}
function kuMinVolume(braname: string): number {
  return form.value.delivery_points.find((d) => d.braname === braname)?.min_supply_volume ?? 1;
}
function setKuMin(braname: string, value: string | number | null): void {
  const n = Math.max(1, Math.floor(Number(value) || 1));
  form.value.delivery_points = form.value.delivery_points.map((d) =>
    d.braname === braname ? { ...d, min_supply_volume: n } : d
  );
}

async function loadKuOptions(): Promise<void> {
  const coopname = systemStore.info?.coopname;
  if (!coopname) return;
  kuLoading.value = true;
  try {
    // Наименование/адрес участка бэкенд резолвит живьём из организации и отдаёт
    // прямо в KU-details (name/addressFull) — фронт не джойнит branches отдельно.
    // Запрос ListKUDetails требует coopname (String!); берём только активные КУ.
    await kuStore.load({ coopname, onlyActive: true });
    kuOptions.value = kuStore.details.map((k) => ({
      braname: k.coreBraname,
      name: k.name || k.coreBraname,
      address: k.addressFull ?? '',
      lat: k.geocodeStatus === GeocodeStatus.OK && k.lat != null ? Number(k.lat) : null,
      lng: k.geocodeStatus === GeocodeStatus.OK && k.lng != null ? Number(k.lng) : null,
    }));
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить кооперативные участки');
  } finally {
    kuLoading.value = false;
  }
}

// Нормализованная (точка-разделитель) цена для отправки и форматирования.
const priceNumberStr = computed(() => form.value.price_per_unit.trim().replace(',', '.'));

// Цена с учётом взноса — то, что реально увидит и заплатит пайщик.
const priceWithFee = computed<number | null>(() => {
  if (!priceNumberStr.value) return null;
  const n = Number(priceNumberStr.value);
  if (Number.isNaN(n)) return null;
  return feePercent.value > 0 ? applyMembershipFee(n, feePercent.value) : n;
});
// В превью крупно — своя цена поставщика (без взноса).
const formattedPrice = computed(() => {
  if (!priceNumberStr.value) return '—';
  const n = Number(priceNumberStr.value);
  if (Number.isNaN(n)) return '—';
  return formatAsset2Digits(`${n} ${governSymbol.value}`);
});
const priceWithFeeHint = computed(() => {
  if (priceWithFee.value == null || feePercent.value <= 0) return '';
  const formatted = formatAsset2Digits(`${priceWithFee.value} ${governSymbol.value}`);
  return `Цена для заказчика: ${formatted} за ${orderUnitLabel.value}`;
});

const stockEmpty = computed(
  () => !form.value.unlimited_flag && (form.value.quantity_available ?? 0) <= 0
);
const stockLabel = computed(() => {
  if (form.value.unlimited_flag) return 'В наличии';
  if (stockEmpty.value) return 'Нет в наличии';
  return `В наличии: ${form.value.quantity_available} × ${orderUnitLabel.value}`;
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
  const images: OfferDraftImage[] = gallery.value
    .filter((g) => g.base64)
    .map((g) => ({
      base64: g.base64 as string,
      mime_type: g.mime_type,
      name: g.name ?? '',
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
    gallery.value = saved.images.map((im) => ({
      uid: `g${++galleryUidSeq}`,
      url: `data:${im.mime_type};base64,${im.base64}`,
      base64: im.base64,
      mime_type: im.mime_type,
      name: im.name,
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

// Галерея в порядке «обложка первой» — для payload и предпросмотра.
function galleryCoverFirst(): GalleryImage[] {
  const arr = gallery.value;
  if (!arr.length) return [];
  const ci = Math.min(Math.max(coverIndex.value, 0), arr.length - 1);
  return [arr[ci], ...arr.filter((_, i) => i !== ci)];
}

const previewImages = computed<Array<{ url: string }>>(() =>
  galleryCoverFirst().map((g) => ({ url: g.url }))
);

function onToggleUnlimited(value: boolean): void {
  form.value.unlimited_flag = value;
}

function setCover(index: number): void {
  coverIndex.value = index;
}

async function onPickFiles(files: readonly File[] | null): Promise<void> {
  const list = files ? [...files] : [];
  // Берём только ещё не добавленные файлы (по имени) — на случай повторного выбора.
  // Добавляем (не заменяем) к уже имеющимся; дедуп новых по имени файла.
  const fresh = list.filter(
    (f) => !gallery.value.some((g) => g.base64 && g.name === f.name)
  );
  for (const file of fresh) {
    if (gallery.value.length >= MAX_IMAGES) {
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
    gallery.value.push({
      uid: `g${++galleryUidSeq}`,
      url: URL.createObjectURL(file),
      base64,
      mime_type: file.type,
      name: file.name,
    });
  }
  // q-file модель не храним — управляем своим списком превью.
  picked.value = null;
}

function removeImage(index: number): void {
  const [removed] = gallery.value.splice(index, 1);
  // object-url освобождаем только у новых файлов; подписанный url существующих
  // освобождать не нужно.
  if (removed?.base64 && removed.url.startsWith('blob:')) URL.revokeObjectURL(removed.url);
  // Сдвигаем выбор обложки, чтобы он не «уехал» на чужой снимок.
  if (index === coverIndex.value) coverIndex.value = 0;
  else if (index < coverIndex.value) coverIndex.value -= 1;
  if (coverIndex.value > gallery.value.length - 1) {
    coverIndex.value = Math.max(0, gallery.value.length - 1);
  }
}

// ===== Навигация =====
function markCompleted(key: string): void {
  if (!completedKeys.value.includes(key)) completedKeys.value.push(key);
}

function validateSupply(): string | null {
  const points = form.value.delivery_points;
  if (!points.length) {
    return 'Отметьте хотя бы один кооперативный участок поставки.';
  }
  if (points.some((d) => !Number.isInteger(d.min_supply_volume) || d.min_supply_volume < 1)) {
    return 'Минимальный объём на каждом участке должен быть целым числом от 1.';
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
// Менялись ли изображения относительно исходного набора (есть новые файлы,
// удалили существующее или сменили обложку/порядок).
function imagesChanged(): boolean {
  if (gallery.value.some((g) => g.base64)) return true;
  const cur = galleryCoverFirst().map((g) => g.bucket_key ?? '');
  if (cur.length !== originalImageKeys.value.length) return true;
  return cur.some((k, i) => k !== originalImageKeys.value[i]);
}

function buildImagesPayload(): MarketplaceOfferImageUpload[] | undefined {
  // В режиме правки не трогаем изображения, если они не менялись — иначе оффер
  // зря уйдёт на повторную модерацию.
  if (isEdit.value && !imagesChanged()) return undefined;
  return galleryCoverFirst().map((g) =>
    g.bucket_key
      ? { bucket_key: g.bucket_key }
      : { base64: g.base64 as string, mime_type: g.mime_type }
  );
}

async function onSubmit(): Promise<void> {
  const f = form.value;

  // Эпик 18: при отпуске упаковкой — валидируем каталог упаковок и собираем его.
  let packagesPayload: MarketplaceCreateOfferPayload['packages'];
  let pricePerUnit = priceNumberStr.value;
  if (f.sale_form === 'packaged') {
    if (f.packages.length === 0) {
      FailAlert(new Error('Добавьте хотя бы одну упаковку.'));
      return;
    }
    for (const p of f.packages) {
      if (!p.size || p.size <= 0) {
        FailAlert(new Error('У каждой упаковки укажите содержимое больше нуля.'));
        return;
      }
      if (!/^\d+([.,]\d{1,4})?$/.test(p.price.trim()) || Number.parseFloat(p.price.replace(',', '.')) <= 0) {
        FailAlert(new Error('У каждой упаковки укажите корректную цену.'));
        return;
      }
    }
    packagesPayload = f.packages.map((p) => ({
      size: p.size as number,
      price: p.price.trim().replace(',', '.'),
      label: p.label.trim() ? p.label.trim() : null,
      is_default: p.is_default,
    }));
    // price_per_unit при упаковочном отпуске backend выводит из упаковки по
    // умолчанию; шлём цену дефолт-упаковки, чтобы удовлетворить валидацию DTO.
    const def = f.packages.find((p) => p.is_default) ?? f.packages[0];
    pricePerUnit = def.price.trim().replace(',', '.');
  }

  const payload: MarketplaceCreateOfferPayload = {
    product_name: f.product_name.trim(),
    description: f.description.trim() ? f.description.trim() : null,
    category_id: f.category_id as number,
    price_per_unit: pricePerUnit,
    unit_of_measure: f.unit_of_measure,
    sale_form: f.sale_form,
    packages: packagesPayload,
    quantity_available: f.unlimited_flag ? null : f.quantity_available,
    unlimited_flag: f.unlimited_flag,
    delivery_points: f.delivery_points,
    shelf_life_days: f.shelf_life_days,
    images: buildImagesPayload(),
  };

  submitting.value = true;
  try {
    if (isEdit.value && editId.value) {
      const wasRejected = currentStatus.value === 'REJECTED';
      await updateOffer({ id: editId.value, ...payload });
      SuccessAlert(
        wasRejected
          ? 'Исправления отправлены на повторную модерацию.'
          : 'Изменения сохранены.'
      );
      void router.push({ name: 'marketplace-my-offers' });
    } else {
      await createOffer(payload);
      clearDraft();
      SuccessAlert('Предложение создано и отправлено на модерацию председателю.');
      // Поставщика возвращаем на его стол «Мои предложения» — там он сразу
      // видит только что созданную оферту в статусе «На модерации», а не в
      // каталог заказчика.
      void router.push({ name: 'marketplace-my-offers' });
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
      price_per_unit: formatPriceForInput(offer.price_per_unit),
      unit_of_measure: offer.unit_of_measure as MarketplaceUnitOfMeasure,
      sale_form: (offer.sale_form as MarketplaceSaleForm) ?? 'by_measure',
      packages: (offer.packages ?? []).map((p) => ({
        id: p.id,
        size: p.size,
        price: formatPriceForInput(p.price),
        label: p.label ?? '',
        is_default: p.is_default,
      })),
      quantity_available: offer.quantity_available,
      unlimited_flag: offer.unlimited_flag,
      delivery_points: (offer.delivery_points ?? []).map((d) => ({
        braname: d.braname,
        min_supply_volume: d.min_supply_volume,
      })),
      shelf_life_days: offer.shelf_life_days,
    };
    gallery.value = (offer.images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        uid: img.bucket_key,
        url: img.url,
        bucket_key: img.bucket_key,
        mime_type: img.mime_type,
      }));
    originalImageKeys.value = gallery.value.map((g) => g.bucket_key as string);
    coverIndex.value = 0;
    currentStatus.value = offer.status;
    rejectReason.value = offer.reject_reason ?? null;
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить предложение');
  } finally {
    prefilling.value = false;
  }
}

onMounted(async () => {
  // Гейт публикации: тихо в фоне — недоступность настроек не блокирует форму.
  void loadSupplierPaymentSettings()
    .then((s) => {
      payoutSettings.value = s;
    })
    .catch(() => undefined);
  void getMembershipFeePercent()
    .then((p) => {
      feePercent.value = p;
    })
    .catch(() => undefined);
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить категории');
  }
  await loadKuOptions();
  if (editId.value) {
    await prefillForEdit(editId.value);
  } else {
    // Восстанавливаем черновик и подключаем автосохранение (клиент-only).
    restoreDraft();
    watch([form, activeKey, completedKeys, gallery, coverIndex], scheduleSaveDraft, {
      deep: true,
    });
  }
});

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  for (const g of gallery.value) if (g.url.startsWith('blob:')) URL.revokeObjectURL(g.url);
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

  // Скелетон формы на время дозагрузки оферты (режим редактирования).
  &__skel {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
    padding: var(--p-4, 16px) 0;
  }

  &__skel-title { width: 35%; }

  &__skel-line { width: 100%; }
  &__skel-line--wide { width: 80%; }
  &__skel-line--narrow { width: 55%; }

  &__manage {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__step {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding-bottom: var(--p-2, 8px);
  }

  &__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--p-3, 12px);
    align-items: start;

    :deep(.q-field) {
      width: 100%;
    }
  }

  &__qty-group {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding: var(--p-3, 12px) var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface-2);
  }

  &__qty-mode {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    gap: var(--p-3, 12px);
    min-height: 32px;
  }

  &__qty-mode-label {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: var(--p-fs-meta, 12px);
    line-height: 1.2;
    white-space: nowrap;
    color: var(--p-ink-3);
    cursor: pointer;
    transition: color 0.15s ease, font-weight 0.15s ease;

    &:hover {
      color: var(--p-ink-2);
    }

    &--active {
      color: var(--p-ink);
      font-weight: 600;
    }
  }

  &__qty-toggle {
    flex-shrink: 0;
  }

  &__qty-input,
  &__field-full {
    width: 100%;
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

  // Строка КУ: чекбокс с наименованием+адресом слева, кнопка карты и
  // поле мин. объёма — справа.
  &__ku-row {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
  }

  &__ku-label {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__ku-name {
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__ku-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__ku-min {
    flex: 0 0 140px;
  }

  &__map {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__map-addr {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
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

  // Навигация формы прибита к низу экрана — «Отменить/Назад» и «Далее/
  // Сохранить» всегда на виду, без прокрутки до конца. Фон перекрывает контент,
  // уезжающий под бар при скролле.
  //
  // margin-bottom компенсирует нижний padding q-page (--p-6): без этого в конце
  // прокрутки бар «приземляется» на величину этого отступа выше, чем стоял
  // прижатым, и кажется, что он меняет высоту/дёргается. С компенсацией позиция
  // «прижат» совпадает с «в покое» — бар не двигается.
  &__foot {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    margin-bottom: calc(-1 * var(--p-6, 24px));
    padding: var(--p-3, 12px) 0;
    background: var(--p-canvas);
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

  &__fee {
    margin: 0;
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
