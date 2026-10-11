<script lang="ts" setup>
import { computed } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { Avatar, BaseCard } from 'src/shared/ui/base';
import type { MarketplaceSupplierProfileView } from 'src/entities/MarketplaceSupplierProfile';

/**
 * Шапка поставщика — одна поверхность с уровнями сверху вниз: обложка, значок
 * поверх её края, строка контекста, крупное имя, факты, под линией числа
 * полосой. Та же шапка стоит на странице поставщика и предпросмотром в
 * «Моём профиле» и «Профиле кооператива»: поставщик видит себя глазами
 * заказчика.
 *
 * Слоты: `context` — строка над именем (возврат, подпись роли), `facts` —
 * строка под именем (оценка, учётное имя), `actions` — действия справа.
 */
const props = defineProps<{
  profile: MarketplaceSupplierProfileView;
}>();

// Инициалы — по словам названия; кавычки вокруг имени кооператива в них не нужны.
const avatarName = computed(() => props.profile.display_name.replace(/["«»„“”']/g, '').trim());
const hasReviews = computed(() => props.profile.reviews_count > 0 && props.profile.rating_avg != null);
const ratingLabel = computed(() =>
  (props.profile.rating_avg ?? 0).toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);
</script>

<template lang="pug">
BaseCard.profile-head
  //- Обложка: снимок поставщика либо спокойная полоса; значок перекрывает её край.
  .profile-head__cover(:class="{ 'profile-head__cover--blank': !profile.cover_url }")
    q-img.profile-head__cover-img(
      v-if="profile.cover_url",
      :src="profile.cover_url",
      fit="cover",
      no-spinner,
      :alt="profile.display_name"
    )
  .profile-head__body
    .profile-head__avatar
      Avatar(:name="avatarName", size="xl")
    .profile-head__row
      .profile-head__identity
        .profile-head__context
          slot(name="context")
            span {{ profile.is_cooperative ? $t('marketplace.supplierProfileHead.eyebrowCooperative') : $t('marketplace.supplierProfileHead.eyebrowSupplier') }}
        h1.profile-head__name {{ profile.display_name }}
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

  &__cover {
    aspect-ratio: 6 / 1;
    max-height: 240px;
    background: var(--p-surface-2);

    &--blank {
      aspect-ratio: auto;
      height: var(--p-10);
    }
  }

  &__cover-img {
    width: 100%;
    height: 100%;
  }

  &__body {
    padding: 0 var(--p-6) var(--p-6);
  }

  // Значок стоит на краю обложки, кольцо цвета поверхности отделяет его от снимка.
  &__avatar {
    display: inline-grid;
    margin-top: calc(-1 * var(--p-7));
    padding: var(--p-1);
    border-radius: 50%;
    background: var(--p-surface);
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
