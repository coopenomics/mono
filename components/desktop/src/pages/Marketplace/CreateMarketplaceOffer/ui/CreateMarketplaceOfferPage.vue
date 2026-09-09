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
        .q-mt-xs Исправьте указанное и нажмите «Отправить на модерацию» — предложение уйдёт на повторную проверку с тем же содержимым.

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
      :errored='erroredKeys',
      @change='goToStep'
    )
      template(#active='{ step }')
        //- ───────── Шаг 1: Товар ─────────
        //- Срок годности стоит здесь, а не в цене: это свойство самого
        //- имущества, от него считается списание скоропорта на складе.
        .offer-wizard__step(v-if='step.key === "basics"')
          BaseInput(
            v-model='form.product_name',
            label='Название товара',
            hint='Как товар увидят заказчики в каталоге',
            maxlength='200',
            counter,
            :error='fieldError("basics", "product_name")'
          )
          BaseSelect(
            v-model='form.category_id',
            :options='categoryOptions',
            label='Категория',
            searchable,
            :error='fieldError("basics", "category_id")'
          )
          BaseInput(
            v-model='form.description',
            label='Описание (необязательно)',
            type='textarea',
            :rows='3',
            autogrow,
            maxlength='2000',
            counter,
            hint='Состав, производитель, особенности — всё, что поможет заказчику'
          )
          AmountInput(
            :model-value='form.shelf_life_days',
            :precision='0',
            symbol='дн.',
            label='Срок годности',
            hint='Сколько дней имущество остаётся годным после приёмки на склад участка. Ноль — товар не портится и по сроку не списывается.',
            @update:model-value='onShelfLifeInput'
          )

        //- ───────── Шаг 2: Цена ─────────
        .offer-wizard__step(v-else-if='step.key === "pricing"')
          BaseSelect(
            v-model='form.unit_of_measure',
            :options='unitOptions',
            label='Единица измерения',
            hint='В ней ведутся цена, содержимое упаковок и остаток'
          )

          .offer-wizard__choice
            .offer-wizard__choice-title Способ отпуска
            .offer-wizard__choice-cards
              BaseRadioCard(
                :model-value='form.sale_form',
                :value='MarketplaceSaleForm.BY_MEASURE',
                title='По мере',
                :description='`Заказчик берёт столько, сколько ему нужно. Цена — за ${orderUnitLabel}.`',
                @update:model-value='onSelectSaleForm'
              )
              BaseRadioCard(
                :model-value='form.sale_form',
                :value='MarketplaceSaleForm.PACKAGED',
                title='Упаковкой',
                description='Товар отпускается целыми упаковками. У каждой упаковки свой объём и своя цена.',
                @update:model-value='onSelectSaleForm'
              )

          //- Отпуск по мере — одна цена за базовую единицу.
          AmountInput(
            v-if='form.sale_form !== MarketplaceSaleForm.PACKAGED',
            :model-value='form.price_per_unit',
            :symbol='governSymbol',
            :label='priceLabel',
            :hint='priceWithFeeHint || undefined',
            :error='fieldError("pricing", "price_per_unit")',
            @update:model-value='onPriceInput'
          )

          //- Отпуск упаковкой — каталог упаковок, по карточке на каждую.
          .offer-wizard__pkgs(v-else)
            .offer-wizard__pkg(v-for='(pkg, i) in form.packages', :key='i')
              header.offer-wizard__pkg-head
                span.offer-wizard__pkg-title {{ packageTitle(pkg, i) }}
                BaseChip(v-if='pkg.is_default', variant='accent', size='sm') Основная
                q-space
                BaseButton(
                  v-if='!pkg.is_default',
                  variant='ghost',
                  size='sm',
                  @click='setDefaultPackage(i)'
                ) Сделать основной
                BaseButton(
                  variant='ghost',
                  icon-only,
                  size='sm',
                  aria-label='Убрать упаковку',
                  :disabled='form.packages.length <= 1',
                  @click='removePackage(i)'
                )
                  template(#icon-left)
                    q-icon(name='delete_outline', size='18px')
              .offer-wizard__pkg-grid
                AmountInput(
                  :model-value='pkg.size',
                  :precision='sizePrecision',
                  :symbol='orderUnitLabel',
                  label='Содержимое',
                  :error='fieldError("pricing", `pkg.${i}.size`)',
                  @update:model-value='(v) => (pkg.size = v)'
                )
                BaseInput(
                  v-model='pkg.package_type',
                  label='Вид упаковки',
                  placeholder='стекло, пластик, корзинка',
                  stack-label,
                  :error='fieldError("pricing", `pkg.${i}.package_type`)'
                )
                AmountInput(
                  :model-value='pkg.price',
                  :symbol='governSymbol',
                  label='Цена упаковки',
                  :error='fieldError("pricing", `pkg.${i}.price`)',
                  @update:model-value='(v) => onPackagePriceInput(pkg, v)'
                )
                BaseInput(
                  v-model='pkg.label',
                  label='Подпись (необязательно)',
                  placeholder='Бутылка 0,5 л',
                  stack-label
                )
              .offer-wizard__pkg-note(v-if='packageNote(pkg)')
                q-icon(name='calculate', size='14px')
                span {{ packageNote(pkg) }}
            .offer-wizard__hint(v-if='form.packages.length > 1')
              | Основная упаковка стоит в карточке каталога первой — её цену заказчик видит до открытия предложения.
            BaseButton.offer-wizard__pkg-add(variant='secondary', size='sm', @click='addPackage')
              template(#icon-left)
                q-icon(name='add', size='16px')
              span.q-ml-sm Добавить упаковку

        //- ───────── Шаг 3: Наличие ─────────
        .offer-wizard__step(v-else-if='step.key === "stock"')
          .offer-wizard__choice
            .offer-wizard__choice-cards
              BaseRadioCard(
                :model-value='stockMode',
                value='limited',
                title='Ограниченное количество',
                description='Заказы принимаются, пока не разберут указанный остаток.',
                @update:model-value='onSelectStockMode'
              )
              BaseRadioCard(
                :model-value='stockMode',
                value='unlimited',
                title='Без ограничения',
                description='Остаток не считается — берёте столько заказов, сколько придёт.',
                @update:model-value='onSelectStockMode'
              )
          template(v-if='!form.unlimited_flag')
            AmountInput(
              v-if='form.sale_form !== MarketplaceSaleForm.PACKAGED',
              :model-value='form.quantity_available',
              :precision='sizePrecision',
              :symbol='orderUnitLabel',
              label='Доступное количество',
              :hint='stockHint',
              :error='fieldError("stock", "quantity_available")',
              @update:model-value='(v) => (form.quantity_available = v)'
            )
            //- Отпуск упаковкой — остаток ведётся на каждой упаковке, в упаковках.
            .offer-wizard__stock-pkgs(v-else)
              p.offer-wizard__hint {{ stockHint }}
              .offer-wizard__card(v-for='(pkg, i) in form.packages', :key='i')
                header.offer-wizard__card-head
                  span.offer-wizard__card-title {{ packageTitle(pkg, i) }}
                  BaseChip(v-if='pkg.is_default', variant='accent', size='sm') Основная
                  q-space
                  span.offer-wizard__card-note(v-if='packageNote(pkg)') {{ packageNote(pkg) }}
                AmountInput.offer-wizard__card-field(
                  :model-value='pkg.quantity_available',
                  :precision='0',
                  symbol='упак.',
                  label='Доступно',
                  :error='fieldError("stock", `pkg.${i}.quantity_available`)',
                  @update:model-value='(v) => (pkg.quantity_available = v)'
                )

        //- ───────── Шаг 4: КУ поставки и минимальный объём ─────────
        .offer-wizard__step(v-else-if='step.key === "supply"')
          p.offer-wizard__hint
            | Отметьте кооперативные участки, на которые готовы обеспечить доставку, и укажите объём поставки на каждый.
          .offer-wizard__hint(v-if='kuLoading') Загрузка участков…
          .offer-wizard__hint(v-else-if='!kuOptions.length') Нет доступных кооперативных участков.
          .offer-wizard__cards
            .offer-wizard__card(
              v-for='ku in kuOptions',
              :key='ku.braname',
              :class='{ "offer-wizard__card--on": isKuSelected(ku.braname) }'
            )
              header.offer-wizard__card-head
                BaseCheckbox(
                  :model-value='isKuSelected(ku.braname)',
                  @update:model-value='(v) => toggleKu(ku.braname, v)'
                )
                  .offer-wizard__ku-label
                    .offer-wizard__card-title {{ ku.name }}
                    .offer-wizard__card-note {{ ku.address }}
                q-space
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
              AmountInput.offer-wizard__card-field(
                v-if='isKuSelected(ku.braname)',
                :model-value='kuMinVolume(ku.braname)',
                label='Минимальный объём поставки',
                :precision='0',
                :min='1',
                :symbol='orderUnitLabel',
                @update:model-value='(v) => setKuMin(ku.braname, v)'
              )

        //- ───────── Шаг 5: Изображения ─────────
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

        //- ───────── Шаг 6: Проверка (карточка-предпросмотр) ─────────
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
              q-icon(name='image', size='52px')
              span Без изображения

            .offer-preview__info
              header.offer-preview__head
                h2.offer-preview__name {{ form.product_name || 'Без названия' }}
                BaseChip(variant='neutral', size='sm') {{ selectedCategoryLabel }}
              .offer-preview__pricebox
                span.offer-preview__price {{ formattedPrice }}
                span.offer-preview__per за {{ previewUnitLabel }}
              p.offer-preview__fee(v-if='priceWithFeeHint') {{ priceWithFeeHint }}
              //- Наличие: по мере — одной строкой, упаковкой — по строке на
              //- упаковку: одно число на все упаковки заказчику ничего не говорит.
              .offer-preview__stock
                BaseChip(v-if='!previewStockRows.length', :variant='stockEmpty ? "neg" : "pos"', size='sm') {{ stockLabel }}
                template(v-else)
                  .offer-preview__stock-title В наличии
                  .offer-preview__stock-row(v-for='row in previewStockRows', :key='row.key')
                    span.offer-preview__stock-name {{ row.name }}
                    span.offer-preview__stock-count {{ row.count }}
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
import { useRoute, useRouter } from 'vue-router';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { AmountInput, PageHint } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';
import { BaseSelect } from 'src/shared/ui/base/BaseSelect';
import { Map as MapView } from 'src/shared/ui/Map';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceKUDetailsStore, GeocodeStatus } from 'src/entities/MarketplaceKUDetails';
import { MARKETPLACE_UNIT_OPTIONS, marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { fileToBase64, formatAsset2Digits } from 'src/shared/lib/utils';
import {
  applyMembershipFee,
  getMembershipFeePercent,
  marketplacePackageStockLabel,
  marketplacePackagesAvailable,
} from 'src/shared/lib/marketplace';
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
  MarketplaceOfferPackageForm,
} from '../types';
// Значения (не только типы) — реальные GraphQL-enum'ы, используются в
// шаблоне и коде как MarketplaceSaleForm.PACKAGED/MarketplaceUnitOfMeasure.KG.
import { MarketplaceSaleForm, MarketplaceUnitOfMeasure } from '../types';

/**
 * Story 3.2 / 4.7: многошаговый мастер публикации Offer'а (по канону
 * MONO Design System, образец — features/Meet/CreateMeet/CreateMeetForm).
 * Шаги: Товар → Цена → Наличие → Условия поставки → Изображения → Проверка.
 * Цена и наличие разведены намеренно: это два разных решения поставщика —
 * почём отдаём и сколько готовы отдать. Срок годности живёт на шаге «Товар»:
 * это свойство самого имущества, а не его цены.
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

// Цена хранится строкой: поле ввода само ограничивает её копейками
// (AmountInput с precision=2), поэтому проверять остаётся только смысл —
// цена заполнена и больше нуля. На цепь backend переводит её в asset нужной
// precision сам (MARKETPLACE_ASSET_CONFIG).
function priceError(raw: string): string | null {
  const value = (raw ?? '').trim().replace(',', '.');
  if (!value) return 'Укажите цену';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Цена должна быть больше нуля';
  return null;
}

// Цена из БД приходит с большей точностью (напр. «100.0000»). При prefill
// приводим её к виду поля ввода — рубли с копейками.
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
    return 'Заполните карточку товара по шагам. После публикации предложение уходит на модерацию администратору — до одобрения оно не появится в каталоге.';
  }
  if (currentStatus.value === 'WITHDRAWN') {
    return 'Доработайте карточку снятого предложения. Пока вы не вернёте его на публикацию, оно остаётся снятым и в каталоге не показывается. При возврате изменённое содержимое снова пройдёт модерацию, неизменное — опубликуется сразу.';
  }
  return 'Заполните карточку товара по шагам. Цена, количество, упаковки и пункты выдачи применяются сразу. Изменение названия, описания, категории, единицы измерения или фотографий снова отправит предложение на модерацию — до одобрения оно будет недоступно в каталоге.';
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
  { key: 'basics', label: 'Товар', description: 'Название, категория, срок годности' },
  { key: 'pricing', label: 'Цена', description: 'Способ отпуска и стоимость' },
  { key: 'stock', label: 'Наличие', description: 'Сколько готовы отдать заказчикам' },
  { key: 'supply', label: 'Условия поставки', description: 'Участки и объём поставки' },
  { key: 'images', label: 'Изображения', description: 'Фотографии товара' },
  { key: 'review', label: 'Проверка и публикация', description: 'Сверьте карточку перед отправкой' },
];
const firstStepKey = steps[0].key;
const activeKey = ref<string>('basics');
const completedKeys = ref<string[]>([]);


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
  unit_of_measure: MarketplaceUnitOfMeasure.PIECE,
  sale_form: MarketplaceSaleForm.BY_MEASURE,
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

// Эпик 18: точность количества — штука неделима (0 знаков), вес и объём
// ведутся до граммов и миллилитров (3 знака). Поля ввода сами не дают набрать
// лишний знак, поэтому проверять точность отдельно приходится только у
// значений, пришедших из уже сохранённого предложения.
const sizePrecision = computed(() =>
  form.value.unit_of_measure === MarketplaceUnitOfMeasure.PIECE ? 0 : 3
);

// Количество в подписи: 0.5 → «0,5» (в интерфейсе запятая, в модели точка).
function formatQuantity(value: number): string {
  return String(value).replace('.', ',');
}

/** Заголовок карточки упаковки: что и в чём, пока не заполнено — просто номер. */
function packageTitle(pkg: MarketplaceOfferPackageForm, index: number): string {
  const parts: string[] = [];
  if (pkg.size) parts.push(`${formatQuantity(pkg.size)} ${orderUnitLabel.value}`);
  const kind = pkg.package_type.trim();
  if (kind) parts.push(kind);
  return parts.length ? parts.join(', ') : `Упаковка ${index + 1}`;
}

/**
 * Цена упаковки в пересчёте на базовую единицу. Упаковки одного товара
 * сравнимы только так: «0,5 л за 120 ₽» и «1 л за 200 ₽» — это 240 и 200 ₽
 * за литр, и поставщик должен видеть это, пока назначает цены.
 */
function packageNote(pkg: MarketplaceOfferPackageForm): string {
  const size = pkg.size ?? 0;
  const price = Number((pkg.price ?? '').trim().replace(',', '.'));
  if (size <= 0 || !Number.isFinite(price) || price <= 0) return '';
  const perUnit = formatAsset2Digits(`${price / size} ${governSymbol.value}`);
  return `${perUnit} за ${orderUnitLabel.value}`;
}

// Поля денег и количеств отдают число (или пусто) — модель формы хранит цену
// строкой, количество числом.
function onPriceInput(value: number | null): void {
  form.value.price_per_unit = value == null ? '' : String(value);
}
function onPackagePriceInput(pkg: MarketplaceOfferPackageForm, value: number | null): void {
  pkg.price = value == null ? '' : String(value);
}
function onShelfLifeInput(value: number | null): void {
  form.value.shelf_life_days = value ?? 0;
}

// Наличие выбирается карточками, а не тумблером: у тумблера с подписями по
// обе стороны не видно, какая сторона включена.
const stockMode = computed(() => (form.value.unlimited_flag ? 'unlimited' : 'limited'));
function onSelectStockMode(value: string | number): void {
  onToggleUnlimited(value === 'unlimited');
}
const stockHint = computed(() =>
  form.value.sale_form === MarketplaceSaleForm.PACKAGED
    ? 'Сколько упаковок каждого вида готовы отдать — остаток ведётся по упаковкам, а не общим объёмом'
    : `Столько ${orderUnitLabel.value} готовы отдать заказчикам`
);

function setDefaultPackage(index: number): void {
  form.value.packages.forEach((p, i) => {
    p.is_default = i === index;
  });
}

function addPackage(): void {
  const isFirst = form.value.packages.length === 0;
  form.value.packages.push({
    size: null,
    price: '',
    label: '',
    package_type: '',
    is_default: isFirst,
    quantity_available: null,
  });
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
function onSelectSaleForm(value: string | number): void {
  const next =
    value === MarketplaceSaleForm.PACKAGED
      ? MarketplaceSaleForm.PACKAGED
      : MarketplaceSaleForm.BY_MEASURE;
  form.value.sale_form = next;
  if (next === MarketplaceSaleForm.PACKAGED && form.value.packages.length === 0) {
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

// Упаковка по умолчанию (для отправки и превью) — то, что реально увидит и
// закажет заказчик при отпуске упаковкой.
const defaultPackage = computed(() =>
  form.value.packages.find((p) => p.is_default) ?? form.value.packages[0] ?? null
);

// Цена в превью: по мере — form.price_per_unit (поле «Цена за ед.»); упаковкой
// — цена упаковки по умолчанию. form.price_per_unit при упаковочном отпуске
// скрыт и может хранить неактуальное значение с прошлого переключения режима
// («по мере» → «упаковкой») или восстановленного черновика — использовать его
// в превью для упаковочного оффера нельзя (инцидент 2026-07-25: превью
// показывало «1 RUB за л» вместо реальной цены упаковки «100 RUB»).
const previewPriceStr = computed(() =>
  form.value.sale_form === MarketplaceSaleForm.PACKAGED
    ? (defaultPackage.value?.price ?? '').trim().replace(',', '.')
    : priceNumberStr.value
);
// Подпись единицы отпуска в превью: по мере — базовая единица («л»);
// упаковкой — размер упаковки по умолчанию («упак. 1 л»), а не базовая
// единица — заказчик покупает целыми упаковками, не по цене за литр/кг.
const previewUnitLabel = computed(() => {
  if (form.value.sale_form !== MarketplaceSaleForm.PACKAGED) return orderUnitLabel.value;
  const size = defaultPackage.value?.size;
  return size ? `упак. ${String(size).replace('.', ',')} ${orderUnitLabel.value}` : orderUnitLabel.value;
});

// Цена с учётом взноса — то, что реально увидит и заплатит пайщик.
const priceWithFee = computed<number | null>(() => {
  if (!previewPriceStr.value) return null;
  const n = Number(previewPriceStr.value);
  if (Number.isNaN(n)) return null;
  return feePercent.value > 0 ? applyMembershipFee(n, feePercent.value) : n;
});
// В превью крупно — своя цена поставщика (без взноса).
const formattedPrice = computed(() => {
  if (!previewPriceStr.value) return '—';
  const n = Number(previewPriceStr.value);
  if (Number.isNaN(n)) return '—';
  return formatAsset2Digits(`${n} ${governSymbol.value}`);
});
const priceWithFeeHint = computed(() => {
  if (priceWithFee.value == null || feePercent.value <= 0) return '';
  const formatted = formatAsset2Digits(`${priceWithFee.value} ${governSymbol.value}`);
  return `Цена для заказчика: ${formatted} за ${previewUnitLabel.value}`;
});

// Остаток при отпуске упаковкой — на каждой упаковке; в превью показываем по
// упаковкам, как увидит заказчик.
const isPackaged = computed(() => form.value.sale_form === MarketplaceSaleForm.PACKAGED);
const stockPackages = computed(() =>
  form.value.packages
    .filter((p) => p.size !== null && p.size > 0)
    .map((p) => ({ size: p.size as number, label: p.label, quantity_available: p.quantity_available ?? 0 }))
);
const stockEmpty = computed(() => {
  if (form.value.unlimited_flag) return false;
  if (isPackaged.value) return marketplacePackagesAvailable(stockPackages.value) <= 0;
  return (form.value.quantity_available ?? 0) <= 0;
});
const stockLabel = computed(() => {
  if (form.value.unlimited_flag) return 'В наличии';
  if (stockEmpty.value) return 'Нет в наличии';
  if (isPackaged.value) {
    return `В наличии: ${marketplacePackageStockLabel(stockPackages.value, form.value.unit_of_measure)}`;
  }
  return `В наличии: ${form.value.quantity_available} ${orderUnitLabel.value}`;
});

/**
 * Наличие в карточке предпросмотра при отпуске упаковкой — по строке на
 * упаковку: слева упаковка, справа сколько её осталось. Одной строкой через
 * разделитель это читается как ребус, а заказчик выбирает именно упаковку.
 * Пусто — показываем прежнюю строку-чип (отпуск по мере, безлимит, «нет в
 * наличии»).
 */
const previewStockRows = computed<Array<{ key: string; name: string; count: string }>>(() => {
  if (!isPackaged.value || form.value.unlimited_flag || stockEmpty.value) return [];
  return form.value.packages
    .filter((p) => p.size !== null && p.size > 0)
    .map((p, i) => ({
      key: p.id ?? String(i),
      name: packageTitle(p, i),
      count: `${p.quantity_available ?? 0} упак.`,
    }));
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
  // Черновик мог быть сохранён ДО перехода unit_of_measure/sale_form на
  // реальные GraphQL-enum'ы (Эпик 18) — тогда в LocalStorage лежат старые
  // строчные значения ('kg', 'packaged'), которых больше нет в enum'е.
  // Слепой мёрж тихо возвращал бы их в форму и валил submit на каждой
  // загрузке, независимо от reload. Не доверяем сохранённому значению, если
  // оно не входит в текущий набор — оставляем свежий дефолт формы.
  const restoredForm: Partial<MarketplaceCreateOfferFormState> = { ...saved.form };
  if (!Object.values(MarketplaceUnitOfMeasure).includes(restoredForm.unit_of_measure!)) {
    delete restoredForm.unit_of_measure;
  }
  if (!Object.values(MarketplaceSaleForm).includes(restoredForm.sale_form!)) {
    delete restoredForm.sale_form;
  }
  form.value = { ...form.value, ...restoredForm };
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

/**
 * Проверка шагов формы. Ошибки считаются всё время, а показываются только
 * после первой попытки уйти со шага: пустая форма не встречает поставщика
 * красным, а исправленное поле гаснет само, без повторного нажатия «Далее».
 */
const FORM_STEP_KEYS = ['basics', 'pricing', 'stock'];
const validated = ref<Record<string, boolean>>({});

const basicsErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {};
  const f = form.value;
  if (!f.product_name.trim()) errors.product_name = 'Укажите название товара';
  if (f.category_id === null) errors.category_id = 'Выберите категорию';
  if (f.shelf_life_days < 0) errors.shelf_life_days = 'Срок годности не может быть отрицательным';
  return errors;
});

const pricingErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {};
  const f = form.value;
  if (f.sale_form !== MarketplaceSaleForm.PACKAGED) {
    const err = priceError(f.price_per_unit);
    if (err) errors.price_per_unit = err;
    return errors;
  }
  if (f.packages.length === 0) {
    errors.packages = 'Добавьте хотя бы одну упаковку';
    return errors;
  }
  const precision = sizePrecision.value;
  f.packages.forEach((pkg, i) => {
    if (!pkg.size || pkg.size <= 0) {
      errors[`pkg.${i}.size`] = 'Укажите содержимое больше нуля';
    } else {
      // Содержимое, пришедшее из уже сохранённого предложения, могло быть
      // задано при другой единице измерения: 0,5 штуки отпустить нельзя.
      const scaled = pkg.size * 10 ** precision;
      if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
        errors[`pkg.${i}.size`] =
          precision === 0
            ? 'В штуках содержимое целое — для веса или объёма выберите единицу «кг» или «литр»'
            : `Не больше ${precision} знаков после запятой`;
      }
    }
    // Вид упаковки заказчик видит в карточке и в корзине — без него непонятно,
    // в чём приедет товар.
    if (!pkg.package_type.trim()) {
      errors[`pkg.${i}.package_type`] = 'Назовите тару: стекло, пластик, корзинка';
    }
    const err = priceError(pkg.price);
    if (err) errors[`pkg.${i}.price`] = err;
  });
  return errors;
});

const stockErrors = computed<Record<string, string>>(() => {
  const errors: Record<string, string> = {};
  const f = form.value;
  if (f.unlimited_flag) return errors;
  if (f.sale_form === MarketplaceSaleForm.PACKAGED) {
    // Остаток задаётся на каждой упаковке — целым числом упаковок.
    f.packages.forEach((pkg, i) => {
      const qty = pkg.quantity_available ?? null;
      if (qty === null) {
        errors[`pkg.${i}.quantity_available`] = 'Укажите, сколько упаковок свободно';
      } else if (qty < 0) {
        errors[`pkg.${i}.quantity_available`] = 'Не может быть отрицательным';
      } else if (!Number.isInteger(qty)) {
        errors[`pkg.${i}.quantity_available`] = 'Целое число упаковок';
      }
    });
    return errors;
  }
  if (f.quantity_available === null) {
    errors.quantity_available = 'Укажите количество или снимите ограничение';
  } else if (f.quantity_available < 0) {
    errors.quantity_available = 'Количество не может быть отрицательным';
  }
  return errors;
});

const stepErrors = computed<Record<string, Record<string, string>>>(() => ({
  basics: basicsErrors.value,
  pricing: pricingErrors.value,
  stock: stockErrors.value,
}));

/** Ошибка поля — только на проверенном шаге; до этого поле чистое. */
function fieldError(stepKey: string, field: string): string | undefined {
  if (!validated.value[stepKey]) return undefined;
  return stepErrors.value[stepKey]?.[field];
}

// Шаг с невыправленными ошибками отмечается в степпере — «Далее» не молчит,
// даже когда проблемное поле ушло за пределы экрана.
const erroredKeys = computed(() =>
  FORM_STEP_KEYS.filter(
    (key) => validated.value[key] && Object.keys(stepErrors.value[key] ?? {}).length > 0
  )
);

/** Первая незакрытая ошибка формы: шаг и текст — для отправки. */
function firstFormError(): { step: string; message: string } | null {
  for (const key of FORM_STEP_KEYS) {
    const message = Object.values(stepErrors.value[key] ?? {})[0];
    if (message) return { step: key, message };
  }
  return null;
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

function goNext(): void {
  const key = activeKey.value;
  if (FORM_STEP_KEYS.includes(key)) {
    validated.value = { ...validated.value, [key]: true };
    if (Object.keys(stepErrors.value[key] ?? {}).length > 0) return;
  } else if (key === 'supply') {
    const err = validateSupply();
    if (err) {
      FailAlert(new Error(err));
      return;
    }
  }
  markCompleted(key);
  if (key === 'images') previewActive.value = 0;
  const order = steps.map((s) => s.key);
  const i = order.indexOf(key);
  if (i >= 0 && i < order.length - 1) activeKey.value = order[i + 1];
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

  // Шаги формы можно обойти по степперу и вернуться на «Проверку» с уже
  // испорченным полем, поэтому перед отправкой сверяемся теми же проверками и
  // возвращаем поставщика на шаг с ошибкой — с показанными полями.
  const blocking = firstFormError();
  if (blocking) {
    validated.value = { ...validated.value, [blocking.step]: true };
    activeKey.value = blocking.step;
    FailAlert(new Error(blocking.message));
    return;
  }

  // Эпик 18: при отпуске упаковкой каталог уходит целиком.
  let packagesPayload: MarketplaceCreateOfferPayload['packages'];
  let pricePerUnit = priceNumberStr.value;
  if (f.sale_form === MarketplaceSaleForm.PACKAGED) {
    packagesPayload = f.packages.map((p) => ({
      // Идентификатор уже сохранённой упаковки возвращаем обратно: на него
      // ссылаются корзины заказчиков, и при правке он должен уцелеть.
      id: p.id ?? null,
      size: p.size as number,
      price: p.price.trim().replace(',', '.'),
      label: p.label.trim() ? p.label.trim() : null,
      package_type: p.package_type.trim(),
      is_default: p.is_default,
      // Остаток ведётся на упаковке; при отпуске без ограничения он не считается.
      quantity_available: f.unlimited_flag ? null : p.quantity_available,
    }));
    // price_per_unit при упаковочном отпуске backend выводит из упаковки по
    // умолчанию; шлём цену дефолт-упаковки, чтобы удовлетворить валидацию DTO.
    pricePerUnit = (defaultPackage.value?.price ?? '').trim().replace(',', '.');
  }

  const payload: MarketplaceCreateOfferPayload = {
    product_name: f.product_name.trim(),
    description: f.description.trim() ? f.description.trim() : null,
    category_id: f.category_id as number,
    price_per_unit: pricePerUnit,
    unit_of_measure: f.unit_of_measure,
    sale_form: f.sale_form,
    packages: packagesPayload,
    // При отпуске упаковкой остаток предложения бэкенд складывает из упаковок.
    quantity_available:
      f.unlimited_flag || f.sale_form === MarketplaceSaleForm.PACKAGED ? null : f.quantity_available,
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
      SuccessAlert('Предложение создано и отправлено на модерацию администратору.');
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
      sale_form: (offer.sale_form as MarketplaceSaleForm) ?? MarketplaceSaleForm.BY_MEASURE,
      packages: (offer.packages ?? []).map((p) => ({
        id: p.id,
        size: p.size,
        price: formatPriceForInput(p.price),
        label: p.label ?? '',
        package_type: p.package_type ?? '',
        is_default: p.is_default,
        quantity_available: p.quantity_available ?? null,
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

  // Выбор режима (способ отпуска, наличие): карточки вместо тумблера с
  // подписями по обе стороны — у тумблера не видно, какая сторона включена.
  &__choice {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__choice-title {
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__choice-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--p-3, 12px);
    align-items: stretch;
  }

  // Каталог упаковок: карточка на упаковку — заголовок с итогом и действиями,
  // поля парами, внизу пересчёт цены на базовую единицу.
  &__pkgs {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__pkg {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface-2);
    padding: var(--p-3, 12px) var(--p-4, 16px) var(--p-2, 8px);
  }

  &__pkg-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    min-height: 32px;
    margin-bottom: var(--p-2, 8px);
  }

  &__pkg-title {
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__pkg-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--p-3, 12px);
  }

  &__pkg-note {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    padding-bottom: var(--p-2, 8px);
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  // Карточка со строкой ввода — общий вид для наличия по упаковкам и для
  // участков поставки. Поле стоит под шапкой, а не рядом с подписью: у него
  // зарезервирована строка подсказки, и в одной строке с текстом оно
  // выглядело бы съехавшим вверх.
  &__stock-pkgs,
  &__cards {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px) var(--p-4, 16px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);

    &--on {
      border-color: var(--p-primary-line, var(--p-primary));
    }
  }

  &__card-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
    min-height: 32px;
  }

  &__card-title {
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__card-note {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    overflow-wrap: anywhere;
  }

  // Поле не тянется во всю карточку: число упаковок и объём — короткие
  // значения, широкое поле под них выглядит пустым.
  &__card-field {
    max-width: 280px;
  }

  &__pkg-add {
    align-self: flex-start;
  }

  &__hint {
    margin: 0;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);

    &--muted {
      font-size: var(--p-fs-meta, 12px);
    }
  }

  // Подпись участка внутри чекбокса: название и адрес друг под другом.
  &__ku-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
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
// На узком экране поля упаковки идут в одну колонку: пара «содержимое — тара»
// в две колонки на телефоне сжимается до нечитаемого.
@media (max-width: 720px) {
  .offer-wizard__pkg-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .offer-wizard__pkg {
    padding: var(--p-3, 12px);
  }

  .offer-wizard__card-field {
    max-width: none;
  }
}

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
  // Цена и её единица — друг под другом: «100,00 RUB» и «за упак. 1 л» в одну
  // строку не помещаются и ломаются на узкие столбики по букве.
  &__pricebox {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
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

  // Наличие по упаковкам — списком: упаковка слева, её остаток справа.
  &__stock {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__stock-title {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
  }

  &__stock-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__stock-name {
    min-width: 0;
    color: var(--p-ink-2);
    overflow-wrap: anywhere;
  }

  &__stock-count {
    flex: 0 0 auto;
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
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
