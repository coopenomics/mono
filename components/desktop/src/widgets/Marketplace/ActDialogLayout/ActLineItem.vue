<template lang="pug">
//- Позиция в таблице акта: миниатюра товара, название, мета-строка (единица
//- отпуска, ТТН, номер заказа). Без снимка — нейтральный значок.
.act-line-item
  .act-line-item__thumb
    q-img(v-if='imageUrl', :src='imageUrl', ratio='1', fit='contain')
    q-icon(v-else, :name='icon', size='20px')
  .act-line-item__text
    .act-line-item__title {{ title }}
    .act-line-item__meta(v-if='meta') {{ meta }}
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    meta?: string;
    imageUrl?: string | null;
    icon?: string;
  }>(),
  { meta: '', imageUrl: null, icon: 'inventory_2' },
);
</script>

<style scoped lang="scss">
.act-line-item {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);

  &__thumb {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border-radius: var(--p-r-sm, 8px);
    overflow: hidden;
    background: var(--p-surface-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-ink-3);

    .q-img {
      width: 100%;
      height: 100%;
    }
  }

  &__text {
    min-width: 0;
  }

  &__title {
    font-size: var(--p-fs-body, 14px);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    margin-top: 2px;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }
}
</style>
