<template lang="pug">
//- Страница приложения — одна для встроенного расширения и приложения из
//- каталога: знак и действия слева, описание, настройки или шаг установки
//- справа. Путь один: открыл, прочитал, подписался или установил,
//- настроил, включил.
.extension-page(v-if='extension || catalogApp')
  button.extension-page__back(type='button', @click='goBack')
    q-icon(name='chevron_left' size='16px')
    span {{ $t('common.action.back') }}

  .extension-page__panel
    .extension-page__grid
      aside.extension-page__side
        AutoAvatar.extension-page__logo(
          :username='seed',
          :size='96',
          radius='var(--p-r-lg, 14px)',
          background='var(--p-surface-2)',
          :ring-color='ringPalette',
          animated
        )
        ExtensionActions(
          v-if='extension',
          :extension='extension',
          :mode='currentMode',
          :config='data',
          :form-ref='myFormRef',
          :is-empty='isEmpty'
        )
        CatalogAppActions(v-else-if='catalogApp', :app='catalogApp')

      .extension-page__main
        template(v-if='extension')
          ExtensionInfo(v-if='isMain', :extension='extension')
          //- Настройки — под названием приложения: видно, какое приложение настраивается.
          .extension-page__heading(v-if='isSettings')
            h2.extension-page__title {{ extension.title }}
            .extension-page__subtitle {{ $t('extensionSettings.extensionSettings.subtitle') }}
          ExtensionSettings(
            v-if='isSettings && extension.schema',
            :schema='extension.schema',
            v-model:config='data',
            :form-ref='myFormRef'
          )
          ExtensionInstall(
            v-if='isInstall',
            :extension-name='extension.name',
            :schema='extension.schema',
            v-model:config='data',
            :form-ref='myFormRef'
          )
        template(v-else-if='catalogApp')
          CatalogAppInfo(v-if='isMain', :app='catalogApp')
          //- Настроек у пакетов каталога пока нет: страница есть, чтобы путь
          //- был тем же, что у встроенных; схема появится вместе с манифестом.
          template(v-if='isSettings || isInstall')
            .extension-page__heading
              h2.extension-page__title {{ catalogApp.title }}
              .extension-page__subtitle {{ $t('extensionSettings.extensionSettings.subtitle') }}
            BaseCard(:title="$t('extensionInstall.extensionInstall.settingsTitle')")
              p.extension-page__note {{ $t('catalogApp.settings.none') }}
</template>
<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { isCatalogAppName, useCatalogAppStore } from 'src/entities/CatalogApp';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isExtensionSchemaEmpty } from 'src/shared/lib/utils';
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';
import { BaseCard } from 'src/shared/ui/base';
import { ExtensionActions } from 'src/widgets/ExtensionActions';
import { ExtensionInfo } from 'src/widgets/ExtensionInfo';
import { ExtensionSettings } from 'src/widgets/ExtensionSettings';
import { ExtensionInstall } from 'src/widgets/ExtensionInstall';
import { CatalogAppActions, CatalogAppInfo } from 'src/widgets/CatalogApp';

const route = useRoute();
const router = useRouter();
const extStore = useExtensionStore();
const catalog = useCatalogAppStore();
const data = ref({});
const myFormRef = ref();

const routeName = computed(() => String(route.params.name ?? ''));
const isCatalog = computed(() => isCatalogAppName(routeName.value));

// Кнопка «Назад» живёт на самой странице (под шапкой), а не в топбаре.
const goBack = () => {
  if (route.name === 'one-extension') {
    router.push({ name: 'extstore-showcase' });
  } else if (route.name === 'extension-install' || route.name === 'extension-settings') {
    router.push({ name: 'one-extension', params: { name: route.params.name } });
  }
};

// realtime: нет источника — страница расширения держит форму его настроек: живое перечитывание затёрло бы ввод; каталог и список установленных живут по ленте.
onMounted(async () => {
  if (!routeName.value) return;
  if (isCatalog.value) {
    if (!catalog.loaded) await catalog.load();
  } else {
    await extStore.loadExtensions({ name: routeName.value });
  }
});

const extension = computed(() =>
  isCatalog.value ? undefined : extStore.extensions.find((el) => el.name == routeName.value),
);
const catalogApp = computed(() => (isCatalog.value ? catalog.find(routeName.value) : undefined));

const seed = computed(() => extension.value?.name || catalogApp.value?.packageId || routeName.value);

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
  background: var(--p-surface);
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
.extension-page__heading {
  margin-bottom: var(--p-5, 20px);
}
.extension-page__title {
  margin: 0;
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1, -0.01em);
  color: var(--p-ink);
}
.extension-page__subtitle {
  margin-top: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}
.extension-page__note {
  margin: 0;
  font-size: var(--p-fs-body);
  line-height: 1.6;
  color: var(--p-ink-2);
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
