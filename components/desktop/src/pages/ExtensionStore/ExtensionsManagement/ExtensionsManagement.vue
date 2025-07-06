<template lang="pug">
div
  .q-pa-md(v-if='showTabs')
    q-btn-toggle(
      v-model='activeTab',
      spread,
      no-caps,
      rounded,
      unelevated,
      toggle-color='primary',
      color='white',
      text-color='primary',
      :options='tabOptions',
      @update:model-value='handleTabChange'
    )

  .q-pa-md
    ExtensionsShowcase(v-if='shouldShowShowcase')
    InstalledExtensions(v-if='shouldShowInstalled')
    router-view(v-if='shouldShowRouterView')
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ExtensionsShowcase } from 'src/pages/ExtensionStore/ExtensionsShowcase';
import { InstalledExtensions } from 'src/pages/ExtensionStore/InstalledExtensions';

const route = useRoute();
const router = useRouter();

const activeTab = ref('showcase');

const tabOptions = [
  { label: 'Витрина расширений', value: 'showcase' },
  { label: 'Установленные', value: 'installed' },
];

// Показываем вкладки на основных маршрутах extensions
const showTabs = computed(() => {
  return (
    route.name === 'extstore-showcase' ||
    route.name === 'appstore-installed' ||
    route.name === 'extensions'
  );
});

// Логика отображения контента
const shouldShowShowcase = computed(() => {
  return (
    (activeTab.value === 'showcase' && showTabs.value) ||
    route.name === 'extensions'
  ); // По умолчанию показываем витрину для базового маршрута
});

const shouldShowInstalled = computed(() => {
  return activeTab.value === 'installed' && showTabs.value;
});

const shouldShowRouterView = computed(() => {
  return !showTabs.value;
});

// Отслеживаем изменения маршрута для обновления активной вкладки
watch(
  () => route.name,
  (newRouteName) => {
    if (newRouteName === 'appstore-installed') {
      activeTab.value = 'installed';
    } else if (
      newRouteName === 'extstore-showcase' ||
      newRouteName === 'extensions'
    ) {
      activeTab.value = 'showcase';
    }
  },
  { immediate: true },
);

const handleTabChange = (value: string) => {
  if (value === 'showcase') {
    router.push({ name: 'extstore-showcase' });
  } else if (value === 'installed') {
    router.push({ name: 'appstore-installed' });
  }
};
</script>
