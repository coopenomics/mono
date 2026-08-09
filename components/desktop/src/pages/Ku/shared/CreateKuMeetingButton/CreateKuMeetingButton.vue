<template lang="pug">
BaseButton(variant='primary', size='sm', @click='emit("click")')
  q-icon.q-mr-xs(name='add')
  | Объявить собрание
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

const emit = defineEmits<{ (e: 'click'): void }>();
</script>
