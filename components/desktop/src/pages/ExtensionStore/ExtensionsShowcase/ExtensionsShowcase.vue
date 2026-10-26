<template lang="pug">
//- Каталог один: встроенные расширения и приложения из каталога лежат в
//- одной сетке одинаковыми карточками. Карточка говорит название, две
//- строки описания, цену и одну пометку состояния; всё остальное — на
//- странице приложения, куда ведёт вся карточка.
.showcase
  BaseBanner.q-mb-md(v-if='catalog.error', variant='neg')
    | {{ $t('extensionStore.showcase.loadFailed') }}: {{ catalog.error }}
    template(#action)
      BaseButton(variant='secondary', size='sm', type='button', @click='catalog.load()') {{ $t('common.action.retry') }}

  .catalog-grid
    ExtensionCard(
      v-for='extension in builtins',
      :key='extension.name',
      :extension='extension'
    )
    template(v-if='catalog.loading && !catalog.loaded')
      article.catalog-skel(v-for='n in 2', :key='"skel-" + n')
        .skel.catalog-skel__tile
        .skel.skel--title(style='width: 140px')
        .skel.skel--text(style='width: 90%')
        .skel.skel--text(style='width: 60%')
    CatalogAppCard(
      v-for='app in catalog.apps',
      :key='app.packageId',
      :app='app'
    )
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useExtensionStore } from 'src/entities/Extension/model';
import { useSystemStore } from 'src/entities/System/model';
import { useCatalogAppStore } from 'src/entities/CatalogApp';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CatalogAppCard, ExtensionCard } from 'src/widgets/ExtensionCard';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';

const extStore = useExtensionStore();
const systemStore = useSystemStore();
const catalog = useCatalogAppStore();

const builtins = computed(() =>
  extStore.extensions.filter(
    (extension) => extension.name !== 'capital' || systemStore.info.coopname === 'voskhod',
  ),
);

// Каталог живёт по ленте изменений: установка, удаление и включение
// расширений (таблица узла extensions) приходят сигналом. Подписки на
// приложения каталога ведёт провайдер — их перечитывает действие.
useLiveReload([{ code: 'core', table: 'extensions' }], () => extStore.loadExtensions());

onMounted(async () => {
  extStore.loadExtensions();
  await catalog.load();
});
</script>

<style scoped lang="scss">
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--p-4);
}

// Заготовка карточки каталога, пока провайдер отдаёт цены.
.catalog-skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-height: 212px;
  padding: var(--p-5);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
}

.catalog-skel__tile {
  width: 44px;
  height: 44px;
  border-radius: var(--p-r-md);
}
</style>
