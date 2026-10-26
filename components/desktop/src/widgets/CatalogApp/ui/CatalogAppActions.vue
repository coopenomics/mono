<template lang="pug">
//- Действия над приложением из каталога — тем же порядком, что у встроенного:
//- подписаться → (настройки) → включить/выключить, отписаться.
.catalog-app-actions
  template(v-if='!live')
    BaseButton.full-width(variant='primary', type='button', :disabled='!canManage', @click='subscribeOpen = true')
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

  BaseDialog(v-model='subscribeOpen', :title="$t('catalogApp.subscribe.title', { title: app.title })", size='sm')
    .catalog-app-actions__dialog
      p(v-if='app.trialDays > 0') {{ $t('catalogApp.subscribe.trialLine', { days: app.trialDays, date: trialEndsOn, amount: priceAmount }) }}
      p(v-else) {{ $t('catalogApp.subscribe.paidLine', { amount: priceAmount }) }}
      p {{ $t('catalogApp.subscribe.walletLine', { operator: operatorLabel }) }}
      BaseBanner(v-if='resultBanner', :variant='resultBanner.variant') {{ resultBanner.text }}
    template(#footer)
      BaseButton(variant='ghost', type='button', :disabled='busy === "subscribe"', @click='closeSubscribe') {{ $t('common.action.close') }}
      BaseButton(
        v-if='!subscribeDone',
        variant='primary',
        type='button',
        :loading='busy === "subscribe"',
        @click='confirmSubscribe'
      ) {{ $t('catalogApp.actions.subscribe') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { BaseBanner, BaseButton, BaseDialog } from 'src/shared/ui/base';
import { useConfirm } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { t } from 'src/shared/i18n';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { type CatalogApp, isLiveSubscription, useCatalogAppStore } from 'src/entities/CatalogApp';
import { runRemotePass } from 'src/processes/init-installed-extensions/remote-pass';
import { formatDay, formatRub } from '../lib/presentation';
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

const busy = ref<'subscribe' | 'toggle' | 'unsubscribe' | null>(null);
const subscribeOpen = ref(false);
const subscribeDone = ref(false);
const resultBanner = ref<{ variant: 'pos' | 'warn' | 'neg'; text: string } | null>(null);

const priceAmount = computed(() => formatRub(props.app.rubPerMonth));
const trialEndsOn = computed(() => {
  const end = new Date();
  end.setDate(end.getDate() + props.app.trialDays);
  return formatDay(end.toISOString());
});

// Имя оператора, у которого ведётся кошелёк: узел узнаёт его из сводки
// подписок. Пока не загружено — общая формулировка.
// realtime: нет источника — оператора кооператива называет провайдер подключения (другой узел), в ленте кооператива его нет.
const operator = ref<string | null>(null);
const operatorLabel = computed(() => operator.value || t('catalogApp.subscribe.operatorFallback'));
onMounted(async () => {
  try {
    const billing = await extensionApi.loadAppsNodeBilling();
    operator.value = billing.operator ?? null;
  } catch {
    operator.value = null;
  }
});

const closeSubscribe = () => {
  subscribeOpen.value = false;
  resultBanner.value = null;
  subscribeDone.value = false;
};

async function confirmSubscribe(): Promise<void> {
  busy.value = 'subscribe';
  resultBanner.value = null;
  try {
    const result = await store.subscribe(props.app.packageId);
    switch (result.status) {
      case Zeus.SubscribePackageStatus.ACTIVATED:
        // Окно закрывается сразу: ход установки виден на странице приложения.
        closeSubscribe();
        SuccessAlert(
          result.state === Zeus.SubscriptionStateEnum.TRIAL
            ? t('catalogApp.subscribe.doneTrial', { date: formatDay(result.endAt) })
            : t('catalogApp.subscribe.donePaid', { date: formatDay(result.endAt) }),
        );
        void runRemotePass(router);
        break;
      case Zeus.SubscribePackageStatus.ALREADY_ACTIVE:
        subscribeDone.value = true;
        resultBanner.value = { variant: 'warn', text: t('catalogApp.subscribe.alreadyActive') };
        break;
      default:
        resultBanner.value = { variant: 'neg', text: result.error || t('catalogApp.subscribe.failed') };
    }
  } catch (e) {
    resultBanner.value = { variant: 'neg', text: e instanceof Error ? e.message : String(e) };
  } finally {
    busy.value = null;
  }
}

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

.catalog-app-actions__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
  p {
    margin: 0;
  }
}
</style>
