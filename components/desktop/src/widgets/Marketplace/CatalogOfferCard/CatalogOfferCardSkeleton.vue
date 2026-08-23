<template lang="pug">
.mp-offer-skel(aria-hidden="true")
  .skel.mp-offer-skel__media
  .skel.skel--text.mp-offer-skel__line.mp-offer-skel__line--cat
  .skel.skel--title.mp-offer-skel__line.mp-offer-skel__line--title
  .skel.skel--num.mp-offer-skel__line.mp-offer-skel__line--price
</template>

<script setup lang="ts">
/**
 * Канон-скелетон карточки предложения (повторяет форму `CatalogOfferCard`:
 * медиа 4/3 сверху, под ней — категория, заголовок, цена). Один компонент для
 * каталога и стола «Мои предложения» — оба грузят сетку CatalogOfferCard и по
 * канону показывают скелетоны вместо перекрывающего спиннера.
 */
</script>

<style scoped lang="scss">
.mp-offer-skel {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;
  padding-bottom: var(--p-3, 12px);

  &__media {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 0;
  }

  &__line {
    margin: var(--p-3, 12px) var(--p-3, 12px) 0;
  }

  &__line--cat {
    width: 40%;
  }
  &__line--title {
    width: 75%;
  }
  &__line--price {
    width: 50%;
  }
}
</style>
