<template lang="pug">
.catalog-grid
  ExtensionCard(
    v-for='extension in installedExtensions',
    :key='extension.name',
    :extension='extension'
  )
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { onMounted, computed } from 'vue';
import { ExtensionCard } from 'src/widgets/ExtensionCard';

const extStore = useExtensionStore();

// Фильтруем только установленные И доступные расширения (исключаем "в разработке")
const installedExtensions = computed(() =>
  extStore.extensions.filter((ext) => ext.is_installed && ext.is_available),
);

onMounted(async () => {
  extStore.loadExtensions({ is_installed: true });
});
</script>

<style scoped lang="scss">
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--p-4, 16px);
}
</style>
