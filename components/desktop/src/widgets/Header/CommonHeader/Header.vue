<!-- Header.vue -->
<template lang="pug">
div
  MainHeader(@toggle-left-drawer='emitToggleLeftDrawer')
</template>

<script setup lang="ts">
import MainHeader from './MainHeader.vue';
import './HeaderStyles.scss';

defineProps({
  showDrawer: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['toggle-left-drawer']);

const emitToggleLeftDrawer = () => {
  emit('toggle-left-drawer');
};
</script>
