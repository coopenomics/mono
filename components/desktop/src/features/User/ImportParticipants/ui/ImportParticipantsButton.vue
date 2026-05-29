<template lang="pug">
//- Canon header-кнопка: на мобильном — только иконка + tooltip.
q-btn(
  @click='show = true',
  :color='isMobile ? "accent" : "primary"',
  :flat='isMobile',
  :dense='isMobile',
  :size='isMobile ? "sm" : undefined',
  icon='upload_file',
  :disable='disable',
  no-wrap
)
  span.q-ml-sm(v-if='!isMobile') Импорт
  q-tooltip(v-if='isMobile') Импорт пайщиков

ParticipantsImportDialog(v-model='show')
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import ParticipantsImportDialog from './ParticipantsImportDialog.vue';

interface Props {
  disable?: boolean;
}

withDefaults(defineProps<Props>(), {
  disable: false,
});

const { isMobile } = useWindowSize();
const show = ref(false);
</script>
