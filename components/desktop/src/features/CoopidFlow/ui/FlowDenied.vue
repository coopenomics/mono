<template lang="pug">
.flow-denied
  BaseBanner(:variant='entered ? "info" : "neg"')
    strong {{ title }}
    |  {{ text }}
  .flow-stage__actions
    BaseButton(variant='primary', @click='emit("leave")') {{ action }}
</template>

<script lang="ts" setup>
/**
 * Отказ (стадии `ak-stage-access-denied`, `ak-stage-flow-error`). Вошедшему отказ означает
 * «вы уже внутри», и кнопка ведёт в стол; перезапуска потока нет — отказ повторился бы.
 */
import { computed } from 'vue';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';
import { t } from 'src/shared/i18n';

const props = defineProps<{ challenge: FlowChallenge; denied: boolean; entered: boolean }>();
const emit = defineEmits<{ leave: [] }>();

const title = computed(() => {
  if (props.entered) return t('coopidFlow.flowDenied.enteredTitle');
  return props.denied ? t('coopidFlow.flowDenied.deniedTitle') : t('coopidFlow.flowDenied.failedTitle');
});
const text = computed(() => {
  if (props.entered) return t('coopidFlow.flowDenied.enteredText');
  return (
    props.challenge.error_message ||
    (props.denied
      ? t('coopidFlow.flowDenied.deniedText')
      : t('coopidFlow.flowDenied.failedText'))
  );
});
const action = computed(() => (props.entered ? t('coopidFlow.flowDenied.enteredAction') : t('coopidFlow.flowDenied.backAction')));
</script>
