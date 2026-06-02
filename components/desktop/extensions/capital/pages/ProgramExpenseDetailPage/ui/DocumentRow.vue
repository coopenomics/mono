<template lang="pug">
q-item
  q-item-section(avatar)
    q-icon(:name='iconName', :color='iconColor', size='28px')
  q-item-section
    q-item-label {{ title }}
    q-item-label(caption) {{ subtitle }}
  q-item-section(side, v-if='document?.hash')
    code.text-caption.text-grey-7 {{ shortHash }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { PropType } from 'vue';

type DocumentAggregate = {
  hash?: string | null;
  doc_hash?: string | null;
  signatures?: Array<unknown> | null;
} | null | undefined;

const props = defineProps({
  title: { type: String, required: true },
  document: { type: Object as PropType<DocumentAggregate>, default: null },
});

const iconName = computed(() => (props.document?.hash ? 'description' : 'insert_drive_file'));
const iconColor = computed(() => (props.document?.hash ? 'primary' : 'grey-5'));

const subtitle = computed(() => {
  if (!props.document?.hash) return 'Документ ещё не приложен';
  const sigs = props.document?.signatures?.length ?? 0;
  return sigs ? `Подписей: ${sigs}` : 'Документ приложен, подписей нет';
});

const shortHash = computed(() => {
  const h = props.document?.hash;
  return h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '';
});
</script>
