<template lang="pug">
.extension-page(v-if='extension')
  button.extension-page__back(type='button', @click='goBack')
    q-icon(name='fa-solid fa-chevron-left' size='13px')
    span Назад

  .extension-page__panel
    .extension-page__grid
      aside.extension-page__side
        AutoAvatar.extension-page__logo(
          :username='extension.name || extension.title || ""',
          :size='96',
          radius='var(--p-r-lg, 14px)',
          background='var(--p-surface-2)',
          :ring-color='ringPalette',
          animated
        )
        ExtensionActions(
          :extension='extension',
          :mode='currentMode',
          :config='data',
          :form-ref='myFormRef',
          :is-empty='isEmpty'
        )

      .extension-page__main
        ExtensionInfo(v-if='isMain', :extension='extension')
        ExtensionSettings(
          v-if='isSettings && extension.schema',
          :schema='extension.schema',
          v-model:config='data',
          :form-ref='myFormRef'
        )
        ExtensionInstall(
          v-if='isInstall',
          :schema='extension.schema',
          v-model:config='data',
          :form-ref='myFormRef'
        )
</template>
<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isExtensionSchemaEmpty } from 'src/shared/lib/utils';
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';
import { ExtensionActions } from 'src/widgets/ExtensionActions';
import { ExtensionInfo } from 'src/widgets/ExtensionInfo';
import { ExtensionSettings } from 'src/widgets/ExtensionSettings';
import { ExtensionInstall } from 'src/widgets/ExtensionInstall';

const route = useRoute();
const router = useRouter();
const extStore = useExtensionStore();
const data = ref({});
const myFormRef = ref();


// Кнопка «Назад» живёт на самой странице (под шапкой), а не в топбаре.
const goBack = () => {
  if (route.name === 'one-extension') {
    // На главной странице расширения - возвращаемся к списку расширений
    router.push({ name: 'extensions' });
  } else if (route.name === 'extension-install' || route.name === 'extension-settings') {
    // На страницах установки/настроек - возвращаемся на главную страницу расширения
    router.push({ name: 'one-extension', params: { name: route.params.name } });
  }
};

onMounted(async () => {
  if (route.params.name) {
    await extStore.loadExtensions({ name: route.params.name as string });
  }
});

const extension = computed(() =>
  extStore.extensions.find((el) => el.name == route.params.name),
);

watch(extension, (newValue) => {
  if (newValue) data.value = newValue.config;
});

const isMain = computed(() => route.name == 'one-extension');
const isInstall = computed(() => route.name == 'extension-install');
const isSettings = computed(() => route.name == 'extension-settings');

const currentMode = computed(() => {
  if (isMain.value) return 'main';
  if (isInstall.value) return 'install';
  if (isSettings.value) return 'settings';
  return 'main';
});

const isEmpty = computed(() => isExtensionSchemaEmpty(extension.value?.schema));

// Та же приглушённая палитра колец, что и в карточке каталога.
const ringPalette = ['5b9aa0', '6f8fae', '74a08c', '9a8fb0', '8aa0a8', 'a8967e'];
</script>

<style scoped lang="scss">
.extension-page {
  // Без собственного padding: страница уже внутри .catalog-shell__content,
  // который задаёт отступы. Иначе — двойной зазор от шапки.
  min-width: 0;
}

.extension-page__back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-5, 20px);
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);
  transition: color 0.15s ease;
  &:hover {
    color: var(--p-ink);
  }
}

.extension-page__panel {
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}

.extension-page__grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--p-6, 24px);
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.extension-page__side {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}

.extension-page__logo {
  // Центрируем логотип в колонке и приглушаем как в карточке каталога.
  align-self: center;
  filter: saturate(0.5);
  opacity: 0.85;
}

.extension-page__main {
  min-width: 0;
}
</style>

<style>
.description h1 {
  font-size: 1.7rem !important;
  margin: 0px !important;
}
.description h2 {
  font-size: 1.5rem !important;
  margin: 0px !important;
}
.description h3 {
  font-size: 1.4rem !important;
  margin: 0px !important;
}
.description h4 {
  font-size: 1.3rem !important;
  margin: 0px !important;
}
.description h5 {
  font-size: 1.2rem !important;
  margin: 0px !important;
}
.description h6 {
  font-size: 1.1rem !important;
  margin: 0px !important;
}
.description ul {
  margin: 0px !important;
}
</style>
