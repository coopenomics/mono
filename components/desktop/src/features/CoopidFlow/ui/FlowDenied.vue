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

const props = defineProps<{ challenge: FlowChallenge; denied: boolean; entered: boolean }>();
const emit = defineEmits<{ leave: [] }>();

const title = computed(() => {
  if (props.entered) return 'Вы уже вошли.';
  return props.denied ? 'Вход не разрешён.' : 'Вход не удался.';
});
const text = computed(() => {
  if (props.entered) return 'Входить заново не нужно. Откройте стол.';
  return (
    props.challenge.error_message ||
    (props.denied
      ? 'Доступ закрыт. Если вы считаете, что это ошибка, обратитесь в кооператив.'
      : 'Что-то сломалось на стороне входа. Попробуйте ещё раз; если повторится — сообщите нам.')
  );
});
const action = computed(() => (props.entered ? 'Открыть стол' : 'Вернуться ко входу'));
</script>
