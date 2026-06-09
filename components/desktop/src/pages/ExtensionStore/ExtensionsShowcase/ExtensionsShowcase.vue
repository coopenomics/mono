<template lang="pug">
BaseBanner.q-mb-md(variant='info')
  | Нативные расширения встроены в платформу и не требуют оплаты.
  | Удалённые пакеты публикуются в каталоге приложений и подключаются
  | по подписке кооператива.

section.catalog-section
  h3.catalog-section__title Нативные расширения
  .catalog-grid
    ExtensionCard(
      v-for='extension in filteredExtensions',
      :key='extension.name',
      :extension='extension'
    )

section.catalog-section.catalog-section--remote
  .catalog-section__head
    h3.catalog-section__title Удалённые пакеты
    span.catalog-section__hint(v-if='!remoteLoading && !remoteError && remoteExtensions.length')
      | Каталог приложений · {{ remoteExtensions.length }} {{ packagesWord }}

  .catalog-grid(v-if='remoteLoading && !remoteExtensions.length')
    article.remote-card(v-for='n in 3', :key='n')
      .remote-card__head
        .remote-card__tile.skel
        .remote-card__heading
          .skel.skel--title(style='width: 140px')
          .skel.skel--text(style='width: 80px')
      .skel.skel--text(style='width: 90%')
      .skel.skel--text(style='width: 60%')

  .catalog-state.catalog-state--error(v-else-if='remoteError')
    q-icon.catalog-state__icon(name='warning', size='28px')
    .catalog-state__body
      h4.catalog-state__title Не удалось загрузить удалённые пакеты
      p.catalog-state__text {{ remoteError }}
      div
        BaseButton(variant='secondary', size='sm', @click='loadRemote') Повторить

  EmptyState(
    v-else-if='!remoteExtensions.length',
    title='Каталог пока пуст',
    body='В каталоге приложений ещё не опубликован ни один пакет. Зайдите позже или соберите свой пакет в столе разработчика.'
  )
    template(#icon)
      q-icon(name='inventory_2', size='28px')

  .catalog-grid(v-else)
    article.remote-card(
      v-for='pkg in remoteExtensions',
      :key='pkg.packageId'
    )
      .remote-card__head
        .remote-card__tile
          q-icon(name='extension', size='22px')
        .remote-card__heading
          h3.remote-card__title {{ pkg.title }}
          BaseBadge(variant='info') Удалённый
      p.remote-card__desc {{ pkg.description }}
      .remote-card__meta
        span.remote-card__publisher
          q-icon(name='business', size='12px')
          | {{ pkg.publisher }}
        span.remote-card__version(
          v-if='pkg.lastActiveVersion',
          title='Последняя активная версия'
        )
          q-icon(name='commit', size='12px')
          | {{ pkg.lastActiveVersion }}
        span.remote-card__price {{ formatPrice(pkg.rubPerMonth) }} ₽/мес
      .remote-card__foot
        BaseButton(variant='primary', size='sm', @click='openSubscribe(pkg)') Подписаться

BaseDialog(v-model='subscribeDialog', :title='subscribeTitle', size='sm')
  .subscribe-dialog__body
    p.q-mb-sm
      | Стоимость: {{ pendingPkg ? formatPrice(pendingPkg.rubPerMonth) : '—' }} ₽/мес.
      | Первый период может быть пробным — это определяет каталог приложений.
    BaseBanner.q-mb-sm(v-if='subscribeResultBanner', :variant='subscribeResultBanner.variant')
      | {{ subscribeResultBanner.text }}
  template(#footer)
    BaseButton(variant='ghost', :disabled='subscribing', @click='closeSubscribe') Закрыть
    BaseButton(
      v-if='!subscribeDone',
      variant='primary',
      :loading='subscribing',
      @click='confirmSubscribe'
    ) Подписаться
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { onMounted, computed, ref } from 'vue';
import { ExtensionCard } from 'src/widgets/ExtensionCard';
import { Queries, Zeus } from '@coopenomics/sdk';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';

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

const packagesWord = computed(() => {
  const n = remoteExtensions.value.length;
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'пакетов';
  if (last === 1) return 'пакет';
  if (last >= 2 && last <= 4) return 'пакета';
  return 'пакетов';
});

function formatPrice(rub: number): string {
  return new Intl.NumberFormat('ru-RU').format(rub);
}

const subscribeDialog = ref(false);
const pendingPkg = ref<RemotePackage | null>(null);
const subscribing = ref(false);
const subscribeDone = ref(false);
const subscribeResultBanner = ref<{ variant: 'pos' | 'warn' | 'neg'; text: string } | null>(null);

const subscribeTitle = computed(() =>
  pendingPkg.value ? `Подписка на ${pendingPkg.value.title}` : 'Подписка на пакет',
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
            ? `Пробная подписка активна до ${formatDate(result.endAt)}.`
            : `Подписка активна до ${formatDate(result.endAt)}.`,
        };
        break;
      case Zeus.SubscribePackageStatus.ALREADY_ACTIVE:
        subscribeDone.value = true;
        subscribeResultBanner.value = {
          variant: 'warn',
          text: 'Подписка на этот пакет уже активна.',
        };
        break;
      case Zeus.SubscribePackageStatus.CLIENT_NOT_REGISTERED:
        subscribeResultBanner.value = {
          variant: 'neg',
          text: 'Кооператив не подключён к каталогу приложений. Обратитесь к оператору каталога.',
        };
        break;
      default:
        subscribeResultBanner.value = {
          variant: 'neg',
          text: result.error || 'Каталог приложений недоступен. Попробуйте позже.',
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
    remoteError.value = msg || 'Каталог приложений недоступен';
    remoteExtensions.value = [];
  } finally {
    remoteLoading.value = false;
  }
}

onMounted(async () => {
  extStore.loadExtensions();
  await loadRemote();
});
</script>

<style scoped lang="scss">
.catalog-section {
  margin-bottom: var(--p-6);
}

.catalog-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
  margin-bottom: var(--p-3);
}

.catalog-section__title {
  margin: 0 0 var(--p-3);
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.catalog-section__hint {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--p-4);
}

.catalog-state {
  display: flex;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-5);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  color: var(--p-ink-2);
}

.catalog-state--error {
  border-color: var(--p-warn);
  background: var(--p-warn-soft);
  color: var(--p-ink);
}

.catalog-state__icon {
  color: var(--p-warn);
}

.catalog-state__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.catalog-state__title {
  margin: 0;
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}

.catalog-state__text {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
}

.remote-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-5);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  min-height: 200px;
  transition: border-color 0.15s ease;
}

.remote-card:hover {
  border-color: var(--p-line-2);
}

.remote-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}

.remote-card__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: var(--p-r-md);
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.remote-card__heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
}

.remote-card__title {
  margin: 0;
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  line-height: 1.3;
}

.remote-card__desc {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}

.remote-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
  margin-top: auto;
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.remote-card__publisher,
.remote-card__version {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}

.remote-card__price {
  margin-left: auto;
  font-weight: 600;
  color: var(--p-ink);
}

.remote-card__foot {
  display: flex;
  justify-content: flex-end;
}

.subscribe-dialog__body {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
