<template lang="pug">
//- Тот же приём, что у заглушки технического обслуживания: сплошной тёмный
//- слой поверх всего. Рабочий стол под ним не виден и не кликается.
transition(name='node-sync-fade')
  div.node-sync(v-if='isBlocking')
    //- Узел не отвечает — для пайщика это технические работы, а не «проблемы
    //- со связью»: причину он иначе будет искать у себя. Вид тот же, что у
    //- планового обслуживания — шестерёнки и подпись.
    div.node-sync__box(v-if='isDisconnected')
      q-spinner-gears.text-white(size='50px')
      h2.node-sync__title.text-white Техническое обслуживание
      p.node-sync__text.text-grey-5 Идут работы на стороне кооператива. Рабочий стол откроется сам, как только они завершатся.

    //- Узел догоняет цепь: показываем ход, чтобы ожидание было понятным.
    div.node-sync__box(v-else)
      q-icon.node-sync__icon.text-white(name='sync', size='40px')
      h2.node-sync__title.text-white Синхронизация с блокчейном
      p.node-sync__text.text-grey-5 Обновляем данные кооператива. Рабочий стол откроется, как только синхронизация завершится.

      q-linear-progress.node-sync__bar(
        :value='progressValue',
        :indeterminate='isIndeterminate',
        color='white',
        track-color='grey-9',
        size='8px',
        rounded
      )
      div.node-sync__meta
        span.node-sync__percent.text-white(v-if='!isIndeterminate') {{ progressPercent }}%
        span.node-sync__remaining.text-grey-5 {{ remainingLabel }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from '../../model/store';

/**
 * Экран синхронизации: пока узел не получил свежие данные, рабочий стол закрыт.
 *
 * Показывает ход, а не просто «ждите»: доля считается от отставания в момент,
 * когда синхронизация началась — абсолютного «сколько всего» у цепи нет, а от
 * точки старта прогресс честно доходит до конца.
 *
 * Номера блоков наружу не выводятся: пайщику они ничего не говорят, а на живой
 * сети это восьмизначные числа.
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

/** Отставание, с которого началась эта синхронизация — точка отсчёта прогресса. */
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

/** Пока связь потеряна, доля прочитанного смысла не имеет — полоса бежит. */
const isIndeterminate = computed(() => isDisconnected.value || !initialLag.value);

/** «около 2 ч 15 мин» читается, «через 8100 с» — нет. */
function formatRemaining(seconds: number): string {
  if (seconds < 60) return 'меньше минуты';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `около ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `около ${hours} ч ${restMinutes} мин` : `около ${hours} ч`;
}

const remainingLabel = computed(() => {
  const eta = state.value?.estimated_seconds_remaining;
  return eta ? `Осталось ${formatRemaining(eta)}` : 'Идёт обновление данных';
});
</script>

<style scoped lang="scss">
.node-sync {
  position: fixed;
  inset: 0;
  /* Выше диалогов Quasar (6000) — экран обязан перекрывать всё, включая
     открытые окна, иначе под ним останется рабочий интерфейс. */
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-4);
  background: var(--q-dark);
}

.node-sync__box {
  width: 100%;
  max-width: 360px;
  text-align: center;
}

.node-sync__icon {
  opacity: 0.9;
}

.node-sync__title {
  margin: var(--p-3) 0 0;
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
}

.node-sync__text {
  margin: var(--p-2) 0 var(--p-5);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.node-sync__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-2);
  margin-top: var(--p-2);
  /* Проценты и подпись меняются каждый тик — фиксируем строку, чтобы блок
     не дёргался по высоте. */
  min-height: 20px;
}

.node-sync__percent {
  font-family: var(--p-mono);
  font-size: var(--p-fs-body);
  font-weight: 600;
  font-feature-settings: 'ss01', 'ss02';
}

.node-sync__remaining {
  margin-left: auto;
  font-size: var(--p-fs-body-sm);
}

.node-sync-fade-enter-active,
.node-sync-fade-leave-active {
  transition: opacity 0.2s ease;
}
.node-sync-fade-enter-from,
.node-sync-fade-leave-to {
  opacity: 0;
}
</style>
