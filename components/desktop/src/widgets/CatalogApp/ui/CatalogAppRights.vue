<template lang="pug">
//- Права ядра подключённого приложения: запрос, на который председатель ещё
//- не ответил, → разрешённые права → переключатель автоприёма новых прав.
//- Блок стоит в карточке страницы приложения тем же столбцом, что факты
//- подписки: своей рамки у него нет, раздел отделяет линия.
section.catalog-app-rights(v-if='rights')
  h3.catalog-app-rights__title {{ $t('catalogApp.rights.title') }}
  //- Запрос прав, на который председатель не ответил: обновление ждёт ответа,
  //- либо подписка оформлена без согласия (каталог не ответил на экране
  //- подписки) и приложение не ставится. Согласие при подписке даётся на
  //- экране подписки, ход установки шага согласия не имеет (28.11.2026).
  .catalog-app-rights__request(v-if='awaiting')
    BaseBanner(variant='warn') {{ requestText }}
    CoreRightsList(:ports='needed.ports', :chain-actions='needed.chainActions')
    .catalog-app-rights__request-actions
      BaseButton(variant='primary', type='button', :loading='busy', :disabled='!canManage', @click='allow')
        | {{ app.installed ? $t('catalogApp.rights.allowUpdate') : $t('catalogApp.rights.allowInstall') }}
    p.catalog-app-rights__hint(v-if='!canManage') {{ $t('catalogApp.rights.chairmanOnly') }}

  .catalog-app-rights__section
    .t-eyebrow.q-mb-sm {{ $t('catalogApp.rights.grantedTitle') }}
    CoreRightsList(v-if='hasGranted', :ports='rights.granted.ports', :chain-actions='rights.granted.chainActions')
    p.catalog-app-rights__hint(v-else) {{ $t('catalogApp.rights.none') }}

  //- Переключатель «Принимать новые права» скрыт: признак включён всем
  //- приложениям, обновление с новыми правами ставится без подтверждения
  //- председателя (487-37, слово владельца 28.11.2026).
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { t } from 'src/shared/i18n';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, awaitsConsent, isLiveSubscription, neededRights, useCatalogAppStore } from 'src/entities/CatalogApp';
import CoreRightsList from './CoreRightsList.vue';
import { APPS_CATALOG_LIVE, useLiveReload } from 'src/shared/lib/realtime';

/**
 * Права ядра приложения каталога на странице приложения. Председатель видит,
 * что приложению разрешено, отвечает на запрос новых прав и решает, принимать
 * ли новые права без вопроса.
 */
const props = defineProps<{ app: CatalogApp }>();

const store = useCatalogAppStore();
const desktop = useDesktopStore();

const live = computed(() => isLiveSubscription(props.app.subscription));
const rights = computed(() => (live.value ? store.rightsOf(props.app.packageId) : undefined));
const needed = computed(() => neededRights(rights.value));
const awaiting = computed(() => awaitsConsent(rights.value));
const hasGranted = computed(() => !!rights.value && rights.value.granted.ports.length + rights.value.granted.chainActions.length > 0);
// Согласие — по праву `Apps:manage`; совет видит права, но кнопки закрыты.
const canManage = computed(() => desktop.hasGrant('apps', 'Apps:manage'));
const busy = ref(false);

const requestText = computed(() => {
  // Версия — из каталога: при первой установке узел версии ещё не знает и запрос её не несёт.
  if (!props.app.installed) return t('catalogApp.rights.requestInstall');
  const version = rights.value?.version;
  return version ? t('catalogApp.rights.requestUpdate', { version }) : t('catalogApp.rights.requestUpdateNoVersion');
});

async function run(action: () => Promise<void>, done?: string): Promise<void> {
  busy.value = true;
  try {
    await action();
    if (done) SuccessAlert(done);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

const allow = () => run(() => store.grantRights(props.app.packageId, needed.value), t('catalogApp.rights.allowed'));

async function load(): Promise<void> {
  if (!live.value) return;
  try {
    await store.loadRights(props.app.packageId);
  } catch (e) {
    FailAlert(e);
  }
}

// Живое обновление по ленте узла: согласие председателя на права ядра.
useLiveReload([APPS_CATALOG_LIVE.rightsConsents], load);
onMounted(load);
watch(() => [props.app.packageId, live.value], load);
</script>

<style scoped>
.catalog-app-rights {
  max-width: 520px;
  margin-top: var(--p-6);
}
.catalog-app-rights__title {
  margin: 0 0 var(--p-4);
  font-size: var(--p-fs-h2);
  font-weight: 600;
  line-height: var(--p-lh-h2);
}
.catalog-app-rights__request {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  margin-bottom: var(--p-4);
}
.catalog-app-rights__request-actions {
  display: flex;
  justify-content: flex-end;
}
.catalog-app-rights__section + .catalog-app-rights__section {
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.catalog-app-rights__hint {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);
}
</style>
