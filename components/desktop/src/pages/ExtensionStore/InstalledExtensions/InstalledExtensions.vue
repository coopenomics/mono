<template lang="pug">
.row
  .col-md-3.col-xs-12(
    v-for='extension in installedExtensions',
    v-bind:key='extension.name'
  )
    ExtensionCard(:extension='extension')
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
