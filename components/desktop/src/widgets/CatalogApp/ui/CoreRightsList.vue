<template lang="pug">
//- Перечень прав ядра: у каждого права название, что оно даёт приложению, и
//- имя из манифеста. Незнакомый порт помечен: такой вызов ядро отклоняет.
q-list.core-rights(separator)
  q-item.core-rights__item(v-for='right in lines', :key='right.key')
    q-item-section
      .text-weight-medium {{ right.title }}
      .t-meta.t-muted {{ right.text }}
    q-item-section(side)
      BaseBadge(v-if='right.unknown', variant='warn') {{ $t('catalogApp.rights.unknown') }}
      span.t-mono-sm.t-muted(v-else) {{ right.code }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base';
import { coreRightLines } from '../lib/coreRights';

const props = defineProps<{ ports: string[]; chainActions: string[] }>();
const lines = computed(() => coreRightLines(props.ports, props.chainActions));
</script>

<style scoped>
.core-rights__item {
  padding-left: 0;
  padding-right: 0;
}
</style>
