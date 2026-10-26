<template lang="pug">
//- Приложение из каталога: цена из публикации у провайдера, состояние —
//- подписка кооператива. Открывается страницей приложения, как встроенное.
AppCard(
  :seed='app.packageId',
  :title='app.title',
  :description='app.description',
  :price='price',
  :state='state',
  clickable,
  @open='open'
)
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { type CatalogApp } from 'src/entities/CatalogApp';
import { catalogAppPrice, catalogAppState } from 'src/widgets/CatalogApp';
import AppCard, { type AppCardState } from './AppCard.vue';

const props = defineProps<{ app: CatalogApp }>();
const router = useRouter();

const price = computed(() => catalogAppPrice(props.app));
const state = computed<AppCardState | null>(() => catalogAppState(props.app));

const open = () => {
  router.push({ name: 'one-extension', params: { name: props.app.packageId } });
};
</script>
