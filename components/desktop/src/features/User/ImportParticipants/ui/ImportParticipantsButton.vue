<template lang="pug">
q-btn(
  color='primary',
  @click='show = true',
  icon='upload_file',
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"',
  :disable='disable'
)
  span.q-pr-sm Импорт
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
