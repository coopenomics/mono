<template lang="pug">
BaseBanner.q-mb-md(variant='info')
  | {{ $t('extensionStore.showcase.intro') }}

//- Каталог приложений один: встроенные и подключаемые по подписке лежат в
//- одной сетке, происхождение — пометка на карточке. Цена — на карточке,
//- подписка — по кнопке с подтверждением суммы.
BaseBanner.q-mb-md(v-if='remoteError', variant='neg')
  | {{ $t('extensionStore.showcase.loadFailed') }}: {{ remoteError }}
  template(#action)
    BaseButton(variant='secondary', size='sm', @click='loadRemote') {{ $t('common.action.retry') }}

.catalog-grid
  ExtensionCard(
    v-for='extension in filteredExtensions',
    :key='extension.name',
    :extension='extension'
  )
  template(v-if='remoteLoading && !remoteExtensions.length')
    article.catalog-skel(v-for='n in 2', :key='"skel-" + n')
      .catalog-skel__head
        .skel.catalog-skel__tile
        .skel.skel--title(style='width: 140px')
      .skel.skel--text(style='width: 90%')
      .skel.skel--text(style='width: 60%')
  AppCard(
    v-for='pkg in remoteExtensions',
    :key='pkg.packageId',
    :seed='pkg.packageId',
    :title='pkg.title',
    :description='pkg.description',
    origin='catalog',
    :price="$t('extensionStore.showcase.perMonth', { amount: formatPrice(pkg.rubPerMonth) })"
  )
    template(#foot)
      BaseButton(variant='secondary', size='sm', @click='openSubscribe(pkg)') {{ $t('extensionStore.showcase.subscribe') }}

BaseDialog(v-model='subscribeDialog', :title='subscribeTitle', size='sm')
  .subscribe-dialog__body
    p.q-mb-sm(v-if='pendingPkg')
      | {{ $t('extensionStore.showcase.price', { amount: formatPrice(pendingPkg.rubPerMonth) }) }}
      | {{ $t('extensionStore.showcase.billingNote') }}
    BaseBanner.q-mb-sm(v-if='subscribeResultBanner', :variant='subscribeResultBanner.variant')
      | {{ subscribeResultBanner.text }}
  template(#footer)
    BaseButton(variant='ghost', :disabled='subscribing', @click='closeSubscribe') {{ $t('common.action.close') }}
    BaseButton(
      v-if='!subscribeDone',
      variant='primary',
      :loading='subscribing',
      @click='confirmSubscribe'
    ) {{ $t('extensionStore.showcase.subscribe') }}
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { onMounted, computed, ref } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { t } from 'src/shared/i18n';
import { AppCard, ExtensionCard } from 'src/widgets/ExtensionCard';
import { Queries, Zeus } from '@coopenomics/sdk';
import { BaseBanner, BaseButton, BaseDialog } from 'src/shared/ui/base';

type RemotePackage = Queries.Extensions.AppsCatalogRemotePackages.IOutput[
  typeof Queries.Extensions.AppsCatalogRemotePackages.name
][number];

const extStore = useExtensionStore();
const systemStore = useSystemStore();

const filteredExtensions = computed(() => {
  return extStore.extensions.filter(
    (extension) => extension.name !== 'capital' || systemStore.info.coopname === 'voskhod',
  );
});

const remoteExtensions = ref<RemotePackage[]>([]);
const remoteLoading = ref(false);
const remoteError = ref<string | null>(null);

function formatPrice(rub: number): string {
  return new Intl.NumberFormat('ru-RU').format(rub);
}

const subscribeDialog = ref(false);
const pendingPkg = ref<RemotePackage | null>(null);
const subscribing = ref(false);
const subscribeDone = ref(false);
const subscribeResultBanner = ref<{ variant: 'pos' | 'warn' | 'neg'; text: string } | null>(null);

const subscribeTitle = computed(() =>
  pendingPkg.value ? t('extensionStore.showcase.subscribeTitle', { title: pendingPkg.value.title }) : t('extensionStore.showcase.subscribeTitleDefault'),
);

function openSubscribe(pkg: RemotePackage) {
  pendingPkg.value = pkg;
  subscribeDone.value = false;
  subscribeResultBanner.value = null;
  subscribeDialog.value = true;
}

function closeSubscribe() {
  subscribeDialog.value = false;
}

async function confirmSubscribe() {
  if (!pendingPkg.value) return;
  subscribing.value = true;
  subscribeResultBanner.value = null;
  try {
    const result = await extensionApi.subscribePackage({
      packageId: pendingPkg.value.packageId,
    });
    switch (result.status) {
      case Zeus.SubscribePackageStatus.ACTIVATED:
        subscribeDone.value = true;
        subscribeResultBanner.value = {
          variant: 'pos',
          text: result.state === Zeus.SubscriptionStateEnum.TRIAL
            ? t('extensionStore.showcase.trialActive', { date: formatDate(result.endAt) })
            : t('extensionStore.showcase.active', { date: formatDate(result.endAt) }),
        };
        break;
      case Zeus.SubscribePackageStatus.ALREADY_ACTIVE:
        subscribeDone.value = true;
        subscribeResultBanner.value = {
          variant: 'warn',
          text: t('extensionStore.showcase.alreadyActive'),
        };
        break;
      case Zeus.SubscribePackageStatus.CLIENT_NOT_REGISTERED:
        subscribeResultBanner.value = {
          variant: 'neg',
          text: t('extensionStore.showcase.notRegistered'),
        };
        break;
      default:
        subscribeResultBanner.value = {
          variant: 'neg',
          text: result.error || t('extensionStore.showcase.unavailableRetry'),
        };
    }
  } catch (e) {
    subscribeResultBanner.value = {
      variant: 'neg',
      text: e instanceof Error ? e.message : String(e),
    };
  } finally {
    subscribing.value = false;
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

async function loadRemote() {
  remoteLoading.value = true;
  remoteError.value = null;
  try {
    const list = await extensionApi.loadAppsCatalogRemotePackages(1, 50);
    remoteExtensions.value = list;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    remoteError.value = msg || t('extensionStore.showcase.unavailable');
    remoteExtensions.value = [];
  } finally {
    remoteLoading.value = false;
  }
}

// Каталог живёт по ленте изменений: установка, удаление и включение
// расширений (таблица узла extensions) приходят сигналом.
useLiveReload([{ code: 'core', table: 'extensions' }], () => extStore.loadExtensions());

onMounted(async () => {
  extStore.loadExtensions();
  await loadRemote();
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
  min-height: 200px;
  padding: var(--p-5);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
}

.catalog-skel__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.catalog-skel__tile {
  width: 48px;
  height: 48px;
  border-radius: var(--p-r-md);
}

.subscribe-dialog__body {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
