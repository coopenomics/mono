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

/**
 * Прочитанный блок в подсказке: он растёт на глазах, и по нему видно, что узел
 * жив и продолжает читать цепь. Без него подсказка утверждает «всё хорошо», но
 * ничем это не подтверждает.
 */
const blockLabel = computed(() => {
  const block = state.value?.current_block_num;
  return typeof block === 'number' ? ` (блок ${block.toLocaleString('ru-RU')})` : '';
});

const hint = computed(() => {
  switch (state.value?.status) {
    case Zeus.NodeSyncStatus.SYNCED:
      return `Данные кооператива синхронизированы${blockLabel.value}`;
    case Zeus.NodeSyncStatus.LAGGING:
      return `Идёт синхронизация с блокчейном${blockLabel.value}`;
    // Узел молчит — для пайщика это технические работы, а не поломка связи
    // у него самого. Причину обрыва разбирает оператор по журналу узла.
    case Zeus.NodeSyncStatus.DISCONNECTED:
      return 'Техническое обслуживание';
    default:
      return '';
  }
});
</script>

<template lang="pug">
span.node-sync-indicator(v-if='tone', :class='`node-sync-indicator--${tone}`')
  q-tooltip {{ hint }}
</template>

<style scoped>
/* Кольцо, а не залитая точка: индикатор стоит у версии и виден с любого стола,
   поэтому не должен тянуть взгляд на себя — заливка читается как тревога. */
.node-sync-indicator {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: transparent;
  /* Контур тоньше вслед за диаметром — иначе кольцо на таком размере
     схлопывается обратно в точку. */
  border: 1px solid var(--p-line);
  /* Центрирование по вертикали не зависит от того, flex вокруг или строка. */
  align-self: center;
  vertical-align: middle;
}

.node-sync-indicator--ok {
  border-color: var(--p-pos);
}

.node-sync-indicator--lagging {
  border-color: var(--p-warn);
}

.node-sync-indicator--offline {
  border-color: var(--p-neg);
}
</style>
