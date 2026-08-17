<template lang="pug">
BaseDialog(
  :model-value='isBlocking',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  div.node-sync-overlay
    AuthCard(:max-width='460')
      //- Шапка: иконка состояния в soft-плитке, заголовок и пояснение — почему
      //- рабочий стол закрыт и чего именно ждёт пайщик.
      template(#head)
        div.node-sync__icon(:class='`node-sync__icon--${view.tone}`')
          q-icon(:name='view.icon', size='28px')
        h2.node-sync__title {{ view.title }}
        p.node-sync__text {{ view.body }}

      //- Ход догона: доля прочитанного, остаток блоков и оценка времени.
      //- Пока связи нет, доля неизвестна — полоса идёт бегущей.
      div.node-sync__progress
        q-linear-progress(
          :value='progressValue',
          :indeterminate='isIndeterminate',
          :color='view.progressColor',
          track-color='grey-3',
          size='10px',
          rounded
        )
        div.node-sync__meta(v-if='!isIndeterminate')
          span.node-sync__percent {{ progressPercent }}%
          span.node-sync__remaining.t-sm.t-muted {{ remainingLabel }}
        div.node-sync__meta(v-else)
          span.node-sync__remaining.t-sm.t-muted {{ remainingLabel }}

      div.node-sync__blocks(v-if='blocksLabel')
        span.node-sync__blocks-label.t-eyebrow.t-faint Позиция чтения
        span.node-sync__blocks-value {{ blocksLabel }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { useSystemStore } from '../../model/store';

/**
 * Экран догона: пока узел не дочитал цепь, рабочий стол закрыт.
 *
 * Показывает не «ждите», а ход: долю прочитанного, остаток блоков и оценку
 * времени. Доля считается от отставания в момент, когда узел ушёл в догон —
 * абсолютного «сколько всего» у цепи нет, а от начальной точки прогресс
 * честно растёт до конца догона.
 */
const systemStore = useSystemStore();
const route = useRoute();

const state = computed(() => systemStore.syncState);

const isLagging = computed(() => state.value?.status === Zeus.NodeSyncStatus.LAGGING);
const isDisconnected = computed(() => state.value?.status === Zeus.NodeSyncStatus.DISCONNECTED);

/** Страницы, на которых чинят сам узел: запирать их этим экраном нельзя. */
const isOnServicePage = computed(() => {
  const path = String(route.path ?? '');
  return path.includes('/install') || path.includes('/_dev');
});

const isBlocking = computed(
  () => Boolean(state.value) && !isOnServicePage.value && (isLagging.value || isDisconnected.value),
);

/** Отставание, с которого начался этот догон — точка отсчёта прогресса. */
const initialLag = ref<number | null>(null);

watch(
  () => [state.value?.status, state.value?.lag_blocks] as const,
  ([status, lag]) => {
    if (status === Zeus.NodeSyncStatus.SYNCED) {
      initialLag.value = null;
      return;
    }
    if (typeof lag !== 'number') return;
    // Отставание выросло — старая точка отсчёта дала бы отрицательный прогресс.
    if (initialLag.value === null || lag > initialLag.value) initialLag.value = lag;
  },
  { immediate: true },
);

const progressValue = computed(() => {
  const lag = state.value?.lag_blocks;
  const start = initialLag.value;
  if (typeof lag !== 'number' || !start) return 0;
  return Math.min(1, Math.max(0, (start - lag) / start));
});

const progressPercent = computed(() => Math.floor(progressValue.value * 100));

/** Пока связи нет, доля прочитанного смысла не имеет — полоса бежит. */
const isIndeterminate = computed(() => isDisconnected.value || !initialLag.value);

/** «через 2 ч 15 мин» читается, «через 8100 с» — нет. */
function formatRemaining(seconds: number): string {
  if (seconds < 60) return 'меньше минуты';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `около ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `около ${hours} ч ${restMinutes} мин` : `около ${hours} ч`;
}

const remainingLabel = computed(() => {
  if (isDisconnected.value) return 'Ждём восстановления связи';
  const lag = state.value?.lag_blocks ?? 0;
  const eta = state.value?.estimated_seconds_remaining;
  const blocks = `осталось ${lag.toLocaleString('ru-RU')} блоков`;
  return eta ? `${blocks} · ${formatRemaining(eta)}` : blocks;
});

const blocksLabel = computed(() => {
  const current = state.value?.current_block_num;
  const head = state.value?.head_block_num;
  if (typeof current !== 'number' || typeof head !== 'number') return '';
  return `${current.toLocaleString('ru-RU')} / ${head.toLocaleString('ru-RU')}`;
});

const view = computed(() => {
  if (isDisconnected.value) {
    const outage = state.value?.outage;
    if (outage === Zeus.NodeSyncOutage.NODE) {
      return {
        icon: 'cloud_off',
        tone: 'neg',
        progressColor: 'negative',
        title: 'Нет связи с узлом кооператива',
        body: 'Рабочий стол не может получить данные. Как только связь восстановится, работа продолжится сама.',
      };
    }
    if (outage === Zeus.NodeSyncOutage.READER) {
      return {
        icon: 'sync_problem',
        tone: 'neg',
        progressColor: 'negative',
        title: 'Чтение блокчейна остановлено',
        body: 'Узел перестал продвигаться по цепи. Данные неполные, поэтому работа приостановлена до возобновления чтения.',
      };
    }
    return {
      icon: 'link_off',
      tone: 'neg',
      progressColor: 'negative',
      title: 'Блокчейн не отвечает',
      body: 'Узел кооператива не получает состояние цепи. Работа продолжится, как только связь восстановится.',
    };
  }

  return {
    icon: 'sync',
    tone: 'primary',
    progressColor: 'primary',
    title: 'Синхронизация с блокчейном',
    body: 'Узел дочитывает цепь. Пока данные неполные, работать с ними нельзя — рабочий стол откроется сам, как только догон закончится.',
  };
});
</script>

<style scoped lang="scss">
.node-sync-overlay {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-4);
}

.node-sync__icon {
  width: 56px;
  height: 56px;
  border-radius: var(--p-r-lg);
  display: grid;
  place-items: center;
  margin: 0 auto var(--p-3);
}
.node-sync__icon--primary {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.node-sync__icon--neg {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}

.node-sync__title {
  margin: 0;
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  color: var(--p-ink);
}
.node-sync__text {
  margin: var(--p-2) 0 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.node-sync__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.node-sync__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-2);
  /* Проценты и остаток меняются каждый тик — фиксируем строку, чтобы карточка
     не дёргалась по высоте. */
  min-height: 20px;
}
.node-sync__percent {
  font-family: var(--p-mono);
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'ss01', 'ss02';
}

.node-sync__blocks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-1);
  margin-top: var(--p-4);
  padding: var(--p-3) var(--p-4);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
  text-align: center;
}
.node-sync__blocks-value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-body);
  color: var(--p-ink);
  font-feature-settings: 'ss01', 'ss02';
}
</style>
