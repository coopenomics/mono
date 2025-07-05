<template lang="pug">
q-btn(
  @click='showDialog = true',
  color='primary',
  push,
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"'
)
  span.q-pr-sm(v-if='!isMobile') добавить
  i.fa-solid.fa-user-plus

AddUserDialog(v-model='showDialog')
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { AddUserDialog } from '../AddUserDialog';
import { useWindowSize } from 'src/shared/hooks';

const { isMobile } = useWindowSize();
const showDialog = ref(false);
</script>
