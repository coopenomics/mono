<template lang="pug">
//- Действия над приложением из каталога — тем же порядком, что у встроенного:
//- подписаться → (настройки) → включить/выключить, отписаться.
.catalog-app-actions
  template(v-if='!live')
    //- Подписка — экраном шагов вместо страницы приложения: права ядра →
    //- итог со стоимостью → «Подписаться» (слово владельца 28.11.2026).
    BaseButton.full-width(variant='primary', type='button', :disabled='!canManage', @click='openSubscribe')
      | {{ app.trialDays > 0 && !app.subscription ? $t('catalogApp.actions.tryFree', { days: app.trialDays }) : $t('catalogApp.actions.subscribe') }}
    p.catalog-app-actions__hint(v-if='!canManage') {{ $t('catalogApp.actions.chairmanOnly') }}

  template(v-else)
    BaseButton.full-width(variant='secondary', type='button', :disabled='!canManage', @click='openSettings')
      | {{ $t('catalogApp.actions.settings') }}
    .catalog-app-actions__row
      BaseButton(
        v-if='app.enabled',
        variant='secondary',
        type='button',
        :loading='busy === "toggle"',
        :disabled='!canManage || !!busy',
        @click='toggle(false)'
      ) {{ $t('catalogApp.actions.disable') }}
      BaseButton(
        v-else,
        variant='primary',
        type='button',
        :loading='busy === "toggle"',
        :disabled='!canManage || !!busy',
        @click='toggle(true)'
      ) {{ $t('catalogApp.actions.enable') }}
      BaseButton(
        variant='danger',
        type='button',
        :loading='busy === "unsubscribe"',
        :disabled='!canManage || !!busy',
        @click='unsubscribe'
      ) {{ $t('catalogApp.actions.unsubscribe') }}
    //- Установка идёт на узле: шаги и опрос — в карточке хода установки,
    //- пока стол пакета не появится в меню.
    CatalogAppInstallProgress(v-if='app.enabled && !deskReady', :app='app')
    //- Столы пакета — тем же блоком, что у встроенного приложения.
    DesktopsList(v-if='deskReady', :desktops='packageDesktops')

</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton } from 'src/shared/ui/base';
import { useConfirm } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { t } from 'src/shared/i18n';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { type CatalogApp, isLiveSubscription, useCatalogAppStore } from 'src/entities/CatalogApp';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import CatalogAppInstallProgress from './CatalogAppInstallProgress.vue';
import { DesktopsList, type IDesktopConfig } from 'src/widgets/ExtensionDesktopsList';

const props = defineProps<{ app: CatalogApp }>();

const router = useRouter();
const store = useCatalogAppStore();
const desktop = useDesktopStore();
const { confirm } = useConfirm();

const live = computed(() => isLiveSubscription(props.app.subscription));
/** Стол пакета уже в меню: установка завершена, ход показывать незачем. */
const deskReady = computed(() =>
  props.app.installed &&
  (desktop.currentDesktop?.workspaces ?? []).some((w) => (w as { extension_name?: string }).extension_name === props.app.packageId),
);
/** Столы пакета на рабочем столе — для блока «Рабочие столы», как у встроенных. */
const packageDesktops = computed<IDesktopConfig[]>(() =>
  (desktop.currentDesktop?.workspaces ?? [])
    .filter((w) => (w as { extension_name?: string }).extension_name === props.app.packageId)
    .map((w) => ({ name: w.name, title: w.title, icon: (w as { icon?: string }).icon ?? 'extension' }) as IDesktopConfig),
);
// Действия — по праву `Apps:manage`; совет видит страницу, но кнопки закрыты.
const canManage = computed(() => desktop.hasGrant('apps', 'Apps:manage'));

const busy = ref<'toggle' | 'unsubscribe' | null>(null);

const openSubscribe = () => {
  void router.push({ name: 'extension-install', params: { name: props.app.packageId } });
};

async function toggle(enabled: boolean): Promise<void> {
  busy.value = 'toggle';
  try {
    await store.setEnabled(props.app.packageId, enabled);
    await runRemotePass(router);
    SuccessAlert(enabled ? t('catalogApp.actions.enabled', { title: props.app.title }) : t('catalogApp.actions.disabledDone', { title: props.app.title }));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

async function unsubscribe(): Promise<void> {
  const ok = await confirm({
    title: t('catalogApp.unsubscribe.title', { title: props.app.title }),
    message: t('catalogApp.unsubscribe.message'),
    confirmLabel: t('catalogApp.actions.unsubscribe'),
    danger: true,
  });
  if (!ok) return;
  busy.value = 'unsubscribe';
  try {
    const result = await store.unsubscribe(props.app.packageId);
    if (result.status === Zeus.UnsubscribePackageStatus.CANCELLED || result.status === Zeus.UnsubscribePackageStatus.NOT_SUBSCRIBED) {
      // Стол пакета снимается в момент отписки; проход по пакетам затем сверяет список с узлом.
      desktop.dropRemoteWorkspacesOf(props.app.packageId);
      await runRemotePass(router);
      SuccessAlert(t('catalogApp.unsubscribe.done', { title: props.app.title }));
    } else {
      FailAlert(result.error || t('catalogApp.subscribe.failed'));
    }
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}

const openSettings = () => {
  router.push({ name: 'extension-settings', params: { name: props.app.packageId } });
};
</script>

<style scoped lang="scss">
.catalog-app-actions {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

.catalog-app-actions__row {
  display: flex;
  gap: var(--p-2, 8px);
  > * {
    flex: 1;
    min-width: 0;
  }
}

.catalog-app-actions__hint {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
</style>
