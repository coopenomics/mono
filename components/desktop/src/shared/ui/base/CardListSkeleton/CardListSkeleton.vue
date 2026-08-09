<template lang="pug">
//- Канон-скелетон списка карточек: несколько hairline-карточек с мерцающими
//- .skel-строками (заголовок / подзаголовок / мета). Канон загрузки требует
//- скелетон, а НЕ спиннер и НЕ мелькающую заглушку «пусто» — поэтому страницы-
//- списки (q-list / карточный грид) на первичной загрузке показывают этот
//- каркас, пока данных ещё нет. Раньше идиома `.skel`-карточек копировалась в
//- OffererIncomingOrders / OffererMyOffers / Cart / SupplyPreparation — здесь
//- единый компонент на все витрины-списки.
.card-skel-list(aria-busy='true', aria-label='Загрузка данных')
  .card-skel(v-for='n in count', :key='n')
    .skel.skel--title.card-skel__line.card-skel__line--head
    .skel.skel--text.card-skel__line.card-skel__line--title
    .skel.skel--num.card-skel__line.card-skel__line--meta
</template>

<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 });
</script>

<style scoped lang="scss">
.card-skel-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}

.card-skel {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-4, 16px);
}

.card-skel__line {
  margin-top: var(--p-3, 12px);

  &:first-child {
    margin-top: 0;
  }
}

.card-skel__line--head {
  width: 50%;
}
.card-skel__line--title {
  width: 80%;
}
.card-skel__line--meta {
  width: 60%;
}
</style>
