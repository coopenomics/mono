<template>
  <!--
    Поднятая полоса вкладок уезжает телепортом под шапку, за пределы боковых
    отступов страницы (см. проп hoist). Выключенный телепорт рендерит ту же
    разметку на месте — вложенным вкладкам внутри страницы поднимать нечего.
  -->
  <Teleport defer to="#page-tabs-host" :disabled="!hoist || !hostReady">
    <!-- Атрибуты страницы (класс, data-*) кладём на саму полосу: корень
         компонента — телепорт, и Vue их туда не наследует. -->
    <nav ref="navRef" class="tabbar" v-bind="$attrs">
    <!--
      Стрелки прокрутки. Появляются обе сразу, как только вкладки перестают
      помещаться, и гаснут поодиночке, когда крутить в ту сторону уже некуда.
      Показывать их по одной нельзя: полоса меняла бы ширину на каждый щелчок
      прокрутки, а на границе помещаемости стрелки мигали бы сами по себе.
    -->
    <TabsScrollArrow
      v-if="scrollable"
      direction="left"
      :disabled="!canScrollLeft"
      @scroll="scrollTowards(-1)"
    />

    <div ref="tabsRef" class="tabbar__tabs">
      <!--
        Вкладки ходят через replace: переключение вкладок — не путешествие, а
        смена среза той же сущности, и push-записи на каждую вкладку
        замусоривали историю. Из-за этого «назад» вместо возврата на предыдущую
        страницу шагал по всем посещённым вкладкам — и по системе расползались
        обходные механизмы угадывания обратного маршрута (см. smartBack.ts).
      -->
      <component
        :is="tab.route ? 'router-link' : 'button'"
        v-for="tab in tabs"
        :key="tab.key"
        :to="tab.route"
        replace
        active-class=""
        exact-active-class=""
        :type="tab.route ? undefined : 'button'"
        :class="['tab', { 'tab--active': isActive(tab) }]"
        :disabled="tab.disabled || undefined"
        @click="onSelect(tab)"
      >
        <q-icon v-if="tab.icon" class="tab__ico" :name="tab.icon" size="15px" />
        <span>{{ tab.label }}</span>
        <span v-if="tab.count !== undefined" class="tab__count">{{ tab.count }}</span>
      </component>
    </div>

    <TabsScrollArrow
      v-if="scrollable"
      direction="right"
      :disabled="!canScrollRight"
      @scroll="scrollTowards(1)"
    />

      <div v-if="$slots.actions" class="tabbar__actions">
        <slot name="actions" />
      </div>
    </nav>
  </Teleport>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabsScroll } from 'src/shared/hooks/useTabsScroll';
import { TabsScrollArrow } from '../TabsScrollArrow';
import { useHoistedTabsHeight } from './useHoistedTabsHeight';
import { PAGE_TABS_HOST } from './PageTabs.types';
import type { PageTabsProps, PageTab } from './PageTabs.types';

defineOptions({ inheritAttrs: false });

const props = defineProps<PageTabsProps>();

const emit = defineEmits<{
  select: [tab: PageTab];
}>();

const route = useRoute();
const router = useRouter();

// Есть ли в каркасе место для поднятой полосы. Признак приходит инъекцией и
// известен до первого рендера: телепорт нельзя включать позже монтирования —
// цель к тому моменту уже запомнена пустой (см. PAGE_TABS_HOST).
const hostReady = inject(PAGE_TABS_HOST, false);

// Высота поднятой полосы уходит в переменную документа: страница под ней
// укорачивается ровно на столько, сколько полоса заняла (см. модуль).
const navRef = ref<HTMLElement | null>(null);
useHoistedTabsHeight(navRef, () => Boolean(props.hoist) && hostReady);

const tabsRef = ref<HTMLElement | null>(null);
const { scrollable, canScrollLeft, canScrollRight, scrollTowards } = useTabsScroll(
  tabsRef,
  () => props.tabs,
);

/**
 * Активность таба. Два источника: ключ, заданный страницей, и собственный
 * маршрут таба. Раздел-оболочка с `<router-view>` внутри не обязан следить за
 * активной вкладкой сам — он объявляет у таба `routeName`, и подсветка
 * остаётся на нём даже когда открыт дочерний маршрут.
 */
function isActive(tab: PageTab): boolean {
  if (props.activeKey !== undefined) return tab.key === props.activeKey;
  if (tab.routeName) {
    if (route.name === tab.routeName) return true;
    return route.matched.some((m) => m.name === tab.routeName);
  }
  return false;
}

function onSelect(tab: PageTab): void {
  if (tab.disabled) return;
  emit('select', tab);
  // Параметры текущего маршрута сохраняются: разделы-оболочки живут внутри
  // маршрута кооператива, и без них переход уводит в никуда
  if (tab.routeName && !isActive(tab)) {
    void router.replace({ name: tab.routeName, params: { ...route.params } });
  }
}
</script>

<style scoped>
/* Режим router-link: нейтрализуем глобальные стили ссылок, чтобы таб-ссылка
   выглядела так же, как таб-кнопка (цвета задаёт канонный .tab) */
a.tab,
a.tab:visited {
  color: var(--p-ink-2);
  text-decoration: none;
}

a.tab:hover {
  color: var(--p-ink);
  text-decoration: none;
}

a.tab--active,
a.tab--active:visited,
a.tab--active:hover {
  color: var(--p-ink);
}
</style>
