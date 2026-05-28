<template lang="pug">
q-btn(
  @click='showDialog = true',
  color='primary',
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"',
  no-wrap
)
  span.q-pr-sm Добавить
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
