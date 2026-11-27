<template lang="pug">
//- Права ядра подключённого приложения: запрос, на который председатель ещё
//- не ответил, → разрешённые права → переключатель автоприёма новых прав.
BaseCard(v-if='rights', :title="$t('catalogApp.rights.title')")
  //- Запрос новых прав: приложение уже работает, обновление ждёт ответа.
  //- У приложения, которое ещё ставится, тот же запрос стоит шагом хода установки.
  .catalog-app-rights__request(v-if='awaiting && app.installed')
    BaseBanner(variant='warn') {{ requestText }}
    CoreRightsList(:ports='needed.ports', :chain-actions='needed.chainActions')
    .catalog-app-rights__request-actions
      BaseButton(variant='primary', type='button', :loading='busy', :disabled='!canManage', @click='allow')
        | {{ $t('catalogApp.rights.allowUpdate') }}
    p.catalog-app-rights__hint(v-if='!canManage') {{ $t('catalogApp.rights.chairmanOnly') }}

  .catalog-app-rights__section
    .t-eyebrow.q-mb-sm {{ $t('catalogApp.rights.grantedTitle') }}
    CoreRightsList(v-if='hasGranted', :ports='rights.granted.ports', :chain-actions='rights.granted.chainActions')
    p.catalog-app-rights__hint(v-else) {{ $t('catalogApp.rights.none') }}

  .catalog-app-rights__section
    q-toggle(
      :model-value='rights.autoAccept',
      :label="$t('catalogApp.rights.autoAccept')",
      :disable='!canManage || busy',
      color='primary',
      @update:model-value='setAutoAccept'
    )
    p.catalog-app-rights__hint {{ $t('catalogApp.rights.autoAcceptHint') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { t } from 'src/shared/i18n';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, awaitsConsent, isLiveSubscription, neededRights, useCatalogAppStore } from 'src/entities/CatalogApp';
import CoreRightsList from './CoreRightsList.vue';

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
const setAutoAccept = (enabled: boolean) => run(() => store.setRightsAutoAccept(props.app.packageId, enabled));

async function load(): Promise<void> {
  if (!live.value) return;
  try {
    await store.loadRights(props.app.packageId);
  } catch (e) {
    FailAlert(e);
  }
}

// realtime: нет источника — права приложения хранит база узла вне ленты цепи, перечень версии отдаёт каталог; блок перечитывается при открытии страницы и после каждого действия.
onMounted(load);
watch(() => [props.app.packageId, live.value], load);
</script>

<style scoped>
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
