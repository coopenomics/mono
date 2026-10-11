<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { Avatar, BaseButton, BaseCard } from 'src/shared/ui/base';
import type { MarketplaceSupplierProfileView } from 'src/entities/MarketplaceSupplierProfile';
import GeneratedCover from './GeneratedCover.vue';

/**
 * Шапка поставщика — одна поверхность с уровнями сверху вниз: обложка, значок
 * поверх её края, строка контекста, крупное имя, факты, под линией числа
 * полосой. Та же шапка стоит на странице поставщика и в «Моём профиле» и
 * «Профиле кооператива» — там в режиме правки: обложка меняется кнопкой,
 * которая появляется при наведении, название правится на месте по нажатию.
 *
 * Слоты: `context` — строка над именем (возврат, подпись роли), `facts` —
 * строка под именем (оценка, учётное имя), `actions` — действия справа.
 */
const props = defineProps<{
  profile: MarketplaceSupplierProfileView;
  /** Режим правки: действия над обложкой и название по нажатию. */
  editable?: boolean;
  /** Принимаемые типы файла обложки (в режиме правки). */
  coverAccept?: string;
  /** Предел длины названия (в режиме правки). */
  nameMax?: number;
  /** Название из черновика; пустое — из профиля. */
  nameOverride?: string | null;
  /** Обложка из черновика: адрес файла, `null` — снята, `undefined` — из профиля. */
  coverOverride?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:name', value: string): void;
  (e: 'cover-pick', file: File): void;
  (e: 'cover-remove'): void;
}>();

const displayName = computed(() => props.nameOverride || props.profile.display_name);
const coverUrl = computed(() =>
  props.coverOverride === undefined ? props.profile.cover_url : props.coverOverride,
);

// Инициалы — по словам названия; кавычки вокруг имени кооператива в них не нужны.
const avatarName = computed(() => displayName.value.replace(/["«»„“”']/g, '').trim());
const hasReviews = computed(() => props.profile.reviews_count > 0 && props.profile.rating_avg != null);
const ratingLabel = computed(() =>
  (props.profile.rating_avg ?? 0).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);

// Обложка: скрытое поле файла открывается кнопкой на самой обложке.
const fileInput = ref<HTMLInputElement | null>(null);

function pickCover(): void {
  fileInput.value?.click();
}

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  // Поле очищается сразу: тот же файл можно выбрать повторно.
  input.value = '';
  if (file) emit('cover-pick', file);
}

// Название правится на месте: по нажатию заголовок становится полем того же
// начертания; Enter и уход с поля заканчивают правку, Escape возвращает прежнее.
const editingName = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
let nameBeforeEdit = '';

function startNameEdit(): void {
  nameBeforeEdit = props.nameOverride ?? '';
  editingName.value = true;
  void nextTick(() => nameInput.value?.focus());
}

function onNameInput(event: Event): void {
  emit('update:name', (event.target as HTMLInputElement).value);
}

function finishNameEdit(): void {
  editingName.value = false;
}

function cancelNameEdit(): void {
  emit('update:name', nameBeforeEdit);
  editingName.value = false;
}
</script>

<template lang="pug">
BaseCard.profile-head(:class="{ 'profile-head--editable': editable }")
  //- Обложка: снимок поставщика либо рисунок из его имени; значок перекрывает её край.
  .profile-head__cover
    q-img.profile-head__cover-img(
      v-if="coverUrl",
      :src="coverUrl",
      fit="cover",
      no-spinner,
      :alt="displayName"
    )
    GeneratedCover(v-else, :seed="profile.supplier_account")
    //- Правка обложки — кнопками на ней самой, видны при наведении.
    .profile-head__cover-actions(v-if="editable")
      BaseButton(variant="secondary", size="sm", @click="pickCover")
        template(#icon-left)
          q-icon(name="photo_camera", size="16px")
        | {{ coverUrl ? $t('marketplace.supplierProfileHead.changeCover') : $t('marketplace.supplierProfileHead.addCover') }}
      BaseButton(v-if="coverUrl", variant="secondary", size="sm", @click="emit('cover-remove')") {{ $t('marketplace.supplierProfileHead.removeCover') }}
      input.profile-head__file(ref="fileInput", type="file", :accept="coverAccept", @change="onFilePicked")
  .profile-head__body
    .profile-head__avatar
      Avatar(:name="avatarName", size="xl")
    .profile-head__row
      .profile-head__identity
        .profile-head__context
          slot(name="context")
            span {{ profile.is_cooperative ? $t('marketplace.supplierProfileHead.eyebrowCooperative') : $t('marketplace.supplierProfileHead.eyebrowSupplier') }}
        template(v-if="editable")
          input.profile-head__name.profile-head__name-input(
            v-if="editingName",
            ref="nameInput",
            type="text",
            :value="nameOverride ?? ''",
            :maxlength="nameMax",
            :placeholder="profile.display_name",
            :aria-label="$t('marketplace.supplierProfileHead.editName')",
            @input="onNameInput",
            @blur="finishNameEdit",
            @keydown.enter.prevent="finishNameEdit",
            @keydown.esc.prevent="cancelNameEdit"
          )
          button.profile-head__name-button(
            v-else,
            type="button",
            :title="$t('marketplace.supplierProfileHead.editName')",
            @click="startNameEdit"
          )
            h1.profile-head__name {{ displayName }}
            q-icon.profile-head__name-pen(name="edit", size="18px")
        h1.profile-head__name(v-else) {{ displayName }}
        .profile-head__facts(v-if="$slots.facts")
          slot(name="facts")
      .profile-head__actions(v-if="$slots.actions")
        slot(name="actions")
  //- Числа — полосой с волосяными разделителями; оценки без отзывов нет.
  .profile-head__figures
    .profile-head__figure
      .profile-head__eyebrow {{ $t('marketplace.supplierProfileHead.offersLabel') }}
      .profile-head__value {{ profile.offers_count }}
    .profile-head__figure
      .profile-head__eyebrow {{ $t('marketplace.supplierProfileHead.reviewsLabel') }}
      .profile-head__value {{ profile.reviews_count }}
    .profile-head__figure(v-if="hasReviews")
      .profile-head__eyebrow {{ $t('marketplace.supplierProfileHead.ratingLabel') }}
      .profile-head__value
        | {{ ratingLabel }}
        span.profile-head__unit {{ $t('marketplace.supplierProfileHead.ratingOutOf') }}
</template>

<style scoped lang="scss">
.profile-head {
  overflow: hidden;

  // Обложка и полоса чисел идут от края до края; поля — у содержимого.
  :deep(.base-card__body) {
    padding: 0;
  }

  // Высота одна и с обложкой, и с рисунком: кнопки над ней стоят одинаково.
  &__cover {
    position: relative;
    aspect-ratio: 6 / 1;
    max-height: 240px;
    background: var(--p-surface-2);
  }

  &__cover-img {
    width: 100%;
    height: 100%;
  }

  // Действия над обложкой лежат на ней лотком цвета поверхности (кнопки с
  // рамкой прозрачны и на снимке не читаются) и проявляются при наведении;
  // без наведения (сенсорный экран) видны всегда.
  &__cover-actions {
    position: absolute;
    right: var(--p-4);
    bottom: var(--p-4);
    display: flex;
    gap: var(--p-1);
    padding: var(--p-1);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md);
    background: var(--p-surface);
    opacity: 0;
    transition: opacity 0.15s ease; // timing: animation — проявление кнопок при наведении
  }

  &__cover:hover &__cover-actions,
  &__cover:focus-within &__cover-actions {
    opacity: 1;
  }

  @media (hover: none) {
    &__cover-actions {
      opacity: 1;
    }
  }

  &__file {
    display: none;
  }

  &__body {
    padding: 0 var(--p-6) var(--p-6);
  }

  // Значок стоит на краю обложки поверх снимка; кольцо цвета поверхности
  // отделяет его от обложки. Цвет — общий для всех значков.
  &__avatar {
    position: relative;
    z-index: 1;
    display: inline-grid;
    margin-top: calc(-1 * var(--p-8));
    padding: var(--p-1);
    border-radius: 50%;
    background: var(--p-surface);

    :deep(.avatar) {
      width: 80px;
      height: 80px;
      font-size: var(--p-fs-h1);
    }
  }

  &__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-4);
    margin-top: var(--p-3);
  }

  &__identity {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
    min-width: 0;
  }

  &__context {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-1) var(--p-2);
    font-size: var(--p-fs-body-sm);
    line-height: var(--p-lh-body-sm);
    color: var(--p-ink-3);
  }

  &__name {
    margin: 0;
    font-size: var(--p-fs-display);
    line-height: var(--p-lh-display);
    letter-spacing: var(--p-ls-display);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  // Название по нажатию: заголовок остаётся заголовком, рядом проявляется
  // карандаш; в правке — поле того же начертания с линией снизу.
  &__name-button {
    display: inline-flex;
    align-items: center;
    gap: var(--p-2);
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
    cursor: text;
    color: inherit;

    &:focus-visible {
      outline: 1px solid var(--p-primary);
      outline-offset: var(--p-1);
      border-radius: var(--p-r-sm);
    }
  }

  &__name-pen {
    color: var(--p-ink-3);
    opacity: 0;
    transition: opacity 0.15s ease; // timing: animation — проявление карандаша при наведении
  }

  &__name-button:hover &__name-pen,
  &__name-button:focus-visible &__name-pen {
    opacity: 1;
  }

  @media (hover: none) {
    &__name-pen {
      opacity: 1;
    }
  }

  &__name-input {
    width: 100%;
    padding: 0;
    border: 0;
    border-bottom: 1px solid var(--p-primary);
    border-radius: 0;
    background: none;
    outline: none;
    font-family: inherit;

    &::placeholder {
      color: var(--p-ink-3);
      font-weight: 500;
    }
  }

  &__facts {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2) var(--p-3);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--p-2);
    flex-shrink: 0;
  }

  // Полоса чисел: ячейки держат свою ширину, между ними волосяная линия.
  &__figures {
    display: flex;
    flex-wrap: wrap;
    border-top: 1px solid var(--p-line);
  }

  &__figure {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
    min-width: 160px;
    padding: var(--p-4) var(--p-6);

    & + & {
      border-left: 1px solid var(--p-line);
    }
  }

  &__eyebrow {
    font-size: var(--p-fs-eyebrow);
    line-height: var(--p-lh-eyebrow);
    letter-spacing: var(--p-ls-eyebrow);
    text-transform: uppercase;
    font-weight: 500;
    color: var(--p-ink-3);
  }

  &__value {
    display: flex;
    align-items: baseline;
    gap: var(--p-2);
    font-size: var(--p-fs-h1);
    line-height: 1;
    letter-spacing: var(--p-ls-h1);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink);
  }

  &__unit {
    font-size: var(--p-fs-body-sm);
    font-weight: 400;
    color: var(--p-ink-3);
  }
}

@media (max-width: 768px) {
  .profile-head {
    &__body {
      padding: 0 var(--p-4) var(--p-4);
    }

    &__row {
      flex-direction: column;
    }

    &__figure {
      min-width: 0;
      flex: 1 1 0;
      padding: var(--p-3) var(--p-4);
    }
  }
}
</style>
