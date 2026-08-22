<template lang="pug">
BaseButton(
  variant='primary',
  size='sm',
  @click='$emit("click", $event)'
) Получить долю в ОАП
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

defineEmits<{
  click: [event: Event];
}>();
</script>
