<template lang="pug">
//- Canon: на мобильном — иконка-only (round + tooltip), на десктопе —
//- иконка + лейбл. Если icon не передан — fallback на label везде.
q-btn(
  :size='isMobile ? "sm" : "md"',
  :flat='!isActive',
  :round='isMobile && !!icon',
  color='secondary',
  :class='{ "route-menu-button-active": isActive }',
  :icon='icon',
  :label='isMobile && icon ? undefined : label',
  no-wrap,
  @click='handleClick'
)
  q-tooltip(v-if='isMobile && icon') {{ label }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWindowSize } from 'src/shared/hooks';

const props = defineProps<{
  routeName: string;
  label: string;
  icon?: string;
  routeParams?: Record<string, any>;
  query?: Record<string, any>;
}>();

const route = useRoute();
const router = useRouter();
const { isMobile } = useWindowSize();

// Определяем, активен ли маршрут
const isActive = computed(() => {
  return route.name === props.routeName;
});

// Обработчик клика
const handleClick = () => {
  router.push({
    name: props.routeName,
    params: props.routeParams || {},
    query: props.query || {},
  });
};
</script>

<style lang="sass" scoped>
@import 'src/app/styles/variables'

.route-menu-button-active
  background: $secondary-gradient-dark !important


</style>
