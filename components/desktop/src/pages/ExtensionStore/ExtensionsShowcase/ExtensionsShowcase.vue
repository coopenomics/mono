<template lang="pug">
.epic9-hint
  q-banner.bg-info.text-white.q-mb-md(rounded)
    template(#avatar)
      q-icon(name='fa-solid fa-rocket')
    | Epic 9 — магазин приложений. Bundle-расширения ниже — нативные,
    | оплачивать не нужно. Удалённые пакеты подгружаются из публичного
    | каталога apps-catalog через проксирующий резолвер controller'а
    | (Story 9.5.b).

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
      | Каталог apps-catalog · {{ remoteExtensions.length }} {{ packagesWord }}

  .catalog-state(v-if='remoteLoading')
    q-spinner-dots(size='32px', color='primary')
    span.catalog-state__text Загружаем каталог apps-catalog…

  .catalog-state.catalog-state--error(v-else-if='remoteError')
    q-icon.catalog-state__icon(name='fa-solid fa-triangle-exclamation', size='28px')
    .catalog-state__body
      h4.catalog-state__title Не удалось загрузить удалённые пакеты
      p.catalog-state__text {{ remoteError }}
      q-btn(
        unelevated,
        color='primary',
        size='sm',
        icon='fa-solid fa-rotate-right',
        label='Повторить',
        @click='loadRemote'
      )

  .catalog-state.catalog-state--empty(v-else-if='!remoteExtensions.length')
    q-icon.catalog-state__icon(name='fa-solid fa-box-open', size='28px')
    .catalog-state__body
      h4.catalog-state__title Каталог пока пуст
      p.catalog-state__text
        | В apps-catalog ещё не опубликован ни один пакет. Зайдите позже
        | или соберите свой пакет в столе разработчика.

  .catalog-grid(v-else)
    article.remote-card(
      v-for='pkg in remoteExtensions',
      :key='pkg.packageId'
    )
      .remote-card__head
        q-avatar(size='48px', color='deep-orange-1', text-color='deep-orange-10')
          q-icon(name='fa-solid fa-cube' size='22px')
        .remote-card__heading
          h3.remote-card__title {{ pkg.title }}
          span.badge.badge--info
            q-icon(name='fa-solid fa-cloud-arrow-down' size='11px')
            | Удалённый
      p.remote-card__desc {{ pkg.description }}
      .remote-card__meta
        span.remote-card__publisher
          q-icon(name='fa-solid fa-building' size='12px')
          | {{ pkg.publisher }}
        span.remote-card__version(
          v-if='pkg.lastActiveVersion',
          title='Последняя активная версия'
        )
          q-icon(name='fa-solid fa-code-branch' size='12px')
          | {{ pkg.lastActiveVersion }}
        span.remote-card__price {{ formatPrice(pkg.rubPerMonth) }} ₽/мес
      .remote-card__foot
        q-btn.remote-card__btn(
          unelevated,
          color='primary',
          label='Подписаться',
          icon='fa-solid fa-plus',
          size='sm',
          @click='openSubscribe(pkg)'
        )

q-dialog(v-model='subscribeDialog')
  q-card.subscribe-dialog
    q-card-section
      .text-h6 Подписка на {{ pendingPkg?.title || 'пакет' }}
    q-card-section.q-pt-none
      p Стоимость: {{ pendingPkg ? formatPrice(pendingPkg.rubPerMonth) : '—' }} ₽/мес.
        | Период оплаты определяется globals.min_payment_period_seconds.
      p.text-caption.q-mb-none
        | Реальная подпись и трансфер AXON будут включены после 9.6.b
        | (auto-extend self-subscription) — сейчас отображается информация
        | из публичного каталога apps-catalog.
    q-card-actions(align='right')
      q-btn(flat, label='Закрыть', v-close-popup)
</template>

<script lang="ts" setup>
import { useExtensionStore } from 'src/entities/Extension/model';
import { useSystemStore } from 'src/entities/System/model';
import { api as extensionApi } from 'src/entities/Extension/api';
import { onMounted, computed, ref } from 'vue';
import { ExtensionCard } from 'src/widgets/ExtensionCard';
import { Queries } from '@coopenomics/sdk';

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

function openSubscribe(pkg: RemotePackage) {
  pendingPkg.value = pkg;
  subscribeDialog.value = true;
}

async function loadRemote() {
  remoteLoading.value = true;
  remoteError.value = null;
  try {
    const list = await extensionApi.loadAppsCatalogRemotePackages(1, 50);
    remoteExtensions.value = list;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    remoteError.value = msg || 'Каталог apps-catalog недоступен';
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
  margin-bottom: var(--p-6, 24px);
}

.catalog-section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  margin-bottom: var(--p-3, 12px);
}

.catalog-section__title {
  margin: 0 0 var(--p-3, 12px);
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
  gap: var(--p-4, 16px);
}

.catalog-state {
  display: flex;
  align-items: center;
  gap: var(--p-4, 16px);
  padding: var(--p-5, 20px);
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  color: var(--p-ink-2);
}

.catalog-state--error {
  border-color: var(--p-warn, #f59e0b);
  background: var(--p-warn-soft, #fff7ed);
  color: var(--p-ink);
}

.catalog-state--empty {
  border-style: dashed;
}

.catalog-state__icon {
  color: var(--p-accent, #f97316);
}

.catalog-state--error .catalog-state__icon {
  color: var(--p-warn, #f59e0b);
}

.catalog-state__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.catalog-state__title {
  margin: 0;
  font-size: var(--p-fs-h4);
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
  gap: var(--p-3, 12px);
  padding: var(--p-5, 20px);
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  min-height: 200px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.remote-card:hover {
  border-color: var(--p-line-strong, #d4d4d8);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.08);
}

.remote-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
}

.remote-card__heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1, 4px);
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
  gap: var(--p-3, 12px);
  margin-top: auto;
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.remote-card__publisher,
.remote-card__version {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
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

.subscribe-dialog {
  min-width: 360px;
}
</style>
