<template lang="pug">
//- Canon header-кнопка: на мобильном — только иконка + tooltip.
q-btn(
  @click='showDialog = true',
  :color='isMobile ? "accent" : "primary"',
  :flat='isMobile',
  :dense='isMobile',
  :size='isMobile ? "sm" : undefined',
  no-wrap
)
  q-icon(name='fa-solid fa-user-plus')
  span.q-ml-sm(v-if='!isMobile') Добавить
  q-tooltip(v-if='isMobile') Добавить пайщика

AddUserDialog(v-model='showDialog')
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AddUserDialog } from '../AddUserDialog';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const showDialog = ref(false);
</script>
