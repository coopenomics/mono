<template lang="pug">
.flow-email
  BaseBanner(variant='info')
    strong {{ $t('coopidFlow.flowEmail.title') }}
    |  {{ $t('coopidFlow.flowEmail.text') }}
  .flow-stage__actions
    BaseButton(variant='secondary', :disabled='sending || secondsLeft > 0', :loading='sending', @click='resend')
      | {{ secondsLeft > 0 ? $t(`coopidFlow.flowEmail.resendCountdown`, { seconds: secondsLeft }) : $t('coopidFlow.flowEmail.resend') }}
</template>

<script lang="ts" setup>
/**
 * «Проверьте почту» (стадия `ak-stage-email`). Повторная отправка не чаще раза в минуту,
 * и минута видна человеку; отметка переживает перезагрузку страницы.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean; slug: string }>();
const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>();

const COOLDOWN_S = 60;
const key = computed(() => `coopid.flow.email-sent.${props.slug}`);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

const sentAt = (): number => Number(localStorage.getItem(key.value) ?? 0);
const secondsLeft = computed(() => Math.max(0, COOLDOWN_S - Math.floor((now.value - sentAt()) / 1000)));

const resend = (): void => {
  localStorage.setItem(key.value, String(Date.now()));
  now.value = Date.now();
  emit('answer', { component: props.challenge.component });
};

onMounted(() => {
  if (!sentAt()) localStorage.setItem(key.value, String(Date.now()));
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>
