<template lang="pug">
//- Установленные приложения: встроенные расширения с установкой и приложения
//- каталога с действующей подпиской — одной сеткой, как на витрине.
.installed
  EmptyState(
    v-if='!extStore.extensions.length && !installedApps.length && catalog.loaded',
    :title="$t('extensionStore.installed.emptyTitle')",
    :body="$t('extensionStore.installed.emptyBody')"
  )
    template(#icon)
      q-icon(name='apps', size='28px')
  .catalog-grid(v-else)
    ExtensionCard(
      v-for='extension in installedExtensions',
      :key='extension.name',
      :extension='extension'
    )
    CatalogAppCard(
      v-for='app in installedApps',
      :key='app.packageId',
      :app='app'
    )
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { isLiveSubscription, useCatalogAppStore } from 'src/entities/CatalogApp';
import { onMounted, computed } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CatalogAppCard, ExtensionCard } from 'src/widgets/ExtensionCard';
import { EmptyState } from 'src/shared/ui/base';

const extStore = useExtensionStore();
const catalog = useCatalogAppStore();

// Фильтруем только установленные И доступные расширения (исключаем "в разработке")
const installedExtensions = computed(() =>
  extStore.extensions.filter((ext) => ext.is_installed && ext.is_available),
);

const installedApps = computed(() => catalog.apps.filter((app) => isLiveSubscription(app.subscription)));

// Каталог живёт по ленте изменений: установка, удаление и включение
// расширений (таблица узла extensions) приходят сигналом.
useLiveReload([{ code: 'core', table: 'extensions' }], () => extStore.loadExtensions({ is_installed: true }));

onMounted(async () => {
  extStore.loadExtensions({ is_installed: true });
  await catalog.load();
});
</script>

<style scoped lang="scss">
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--p-4, 16px);
}
</style>
