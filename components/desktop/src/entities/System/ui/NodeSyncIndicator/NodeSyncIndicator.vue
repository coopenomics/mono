<script setup lang="ts">
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
// Напрямую из store, а не через бочку модели: индикатору незачем тянуть за
// собой ws-подписку со всем её транспортом.
import { useSystemStore } from '../../model/store';

/**
 * Кружок состояния узла рядом с версией: зелёный — узел у головы цепи,
 * жёлтый — догоняет, красный — связи нет. Пока состояние не известно, кружок
 * не рисуется: пустое место честнее зелёного «всё хорошо».
 */
const systemStore = useSystemStore();

const state = computed(() => systemStore.syncState);

const tone = computed(() => {
  switch (state.value?.status) {
    case Zeus.NodeSyncStatus.SYNCED:
      return 'ok';
    case Zeus.NodeSyncStatus.LAGGING:
      return 'lagging';
    case Zeus.NodeSyncStatus.DISCONNECTED:
      return 'offline';
    default:
      return null;
  }
});

const hint = computed(() => {
  const value = state.value;
  if (!value) return '';
  if (value.status === Zeus.NodeSyncStatus.SYNCED) return 'Узел синхронизирован с блокчейном';
  if (value.status === Zeus.NodeSyncStatus.LAGGING) {
    const lag = (value.lag_blocks ?? 0).toLocaleString('ru-RU');
    return `Узел догоняет блокчейн: осталось ${lag} блоков`;
  }
  if (value.outage === Zeus.NodeSyncOutage.NODE) return 'Нет связи с узлом кооператива';
  if (value.outage === Zeus.NodeSyncOutage.READER) return 'Чтение блокчейна остановлено';
  return 'Блокчейн не отвечает';
});
</script>

<template lang="pug">
span.node-sync-indicator(v-if='tone', :class='`node-sync-indicator--${tone}`')
  q-tooltip {{ hint }}
</template>

<style scoped>
.node-sync-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--p-line);
}

.node-sync-indicator--ok {
  background: var(--p-pos);
}

.node-sync-indicator--lagging {
  background: var(--p-warn);
}

.node-sync-indicator--offline {
  background: var(--p-neg);
}
</style>
