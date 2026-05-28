<template lang="pug">
nav.tabbar
  .tabbar__tabs
    button.tab(
      v-for='t in tabs',
      :key='t.routeName',
      type='button',
      :class='{ "tab--active": isActive(t) }',
      @click='navigate(t)'
    )
      q-icon.tab__ico(v-if='t.icon', :name='t.icon', size='15px')
      span {{ t.label }}
  .tabbar__actions(v-if='$slots.actions')
    slot(name='actions')
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

/**
 * Канон-меню второго уровня (sub-navigation) для столов с дочерними
 * маршрутами. Рендерит горизонтальный таб-бар между топбаром и контентом
 * на глобальных классах дизайн-системы (.tabbar/.tab из mono-platform).
 * Активная вкладка подсвечивается подчёркиванием по route.matched, поэтому
 * вложенные дочерние маршруты тоже корректно подсвечивают свой таб.
 *
 * Действия страницы (напр. «Перевести») — через слот #actions справа,
 * либо отдельно в топбаре через useHeaderActions (на усмотрение страницы).
 */
interface SecondLevelTab {
  routeName: string;
  label: string;
  icon?: string;
}

defineProps<{
  tabs: SecondLevelTab[];
}>();

const route = useRoute();
const router = useRouter();

function isActive(tab: SecondLevelTab): boolean {
  if (route.name === tab.routeName) return true;
  // Дочерний маршрут таба — подсветка остаётся на табе-родителе.
  return route.matched.some((m) => m.name === tab.routeName);
}

function navigate(tab: SecondLevelTab): void {
  if (isActive(tab)) return;
  router.push({ name: tab.routeName, params: { ...route.params } });
}
</script>

<style scoped lang="scss">
// Иконка таба наследует приглушённый цвет, активная — как текст таба.
.tab__ico {
  color: var(--p-ink-3);
}
.tab--active .tab__ico {
  color: var(--p-primary);
}
</style>
