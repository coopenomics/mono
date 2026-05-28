<template lang="pug">
.catalog-grid
  ExtensionCard(
    v-for='extension in filteredExtensions',
    :key='extension.name',
    :extension='extension'
  )
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { useSystemStore } from 'src/entities/System/model';
import { onMounted, computed } from 'vue';
import { ExtensionCard } from 'src/widgets/ExtensionCard';

const extStore = useExtensionStore();
const systemStore = useSystemStore();

const filteredExtensions = computed(() => {
  // Временно: скрываем расширение 'capital' для всех кооперативов кроме 'voskhod'
  // TODO: убрать фильтрацию потом, когда станет доступно для всех
  return extStore.extensions.filter(
    (extension) => extension.name !== 'capital' || systemStore.info.coopname === 'voskhod',
  );
});

onMounted(async () => {
  extStore.loadExtensions();
});
</script>

<style scoped lang="scss">
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--p-4, 16px);
}
</style>
