<template lang="pug">
BaseButton(
  variant='primary',
  size='sm',
  @click='$emit("click", $event)'
) {{ $t('capital.convertSegmentButton.label') }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base';

defineEmits<{
  click: [event: Event];
}>();
</script>
