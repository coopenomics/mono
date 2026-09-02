<template lang="pug">
.flow-code
  p.flow-stage__lead {{ lead }}
  BaseForm(:loading='sending', @submit='submit')
    OtpInput(v-model='code', :length='6', :error='error', :disabled='sending', autofocus, name='code', @complete='submit')
    .flow-stage__actions
      BaseButton(variant='primary', type='submit', :loading='sending', :disabled='code.length < 6') Войти
    .flow-stage__links(v-if='emailDevice')
      BaseButton(variant='ghost', size='sm', :disabled='sending', @click='choose') Отправить код ещё раз
</template>

<script lang="ts" setup>
/**
 * Код подтверждения (стадии `ak-stage-authenticator-email` и `ak-stage-authenticator-validate`).
 *
 * Почтовое устройство выбирается само (выбор и просит authentik отправить код); для
 * приложения-аутентификатора код просто вводится. Последняя цифра отправляет код сама.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { BaseButton, BaseForm } from 'src/shared/ui/base';
import { OtpInput } from 'src/shared/ui/domain';
import { fieldError, FlowStage, type FlowChallenge } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>();

const code = ref('');
const validating = computed(() => props.challenge.component === FlowStage.AuthenticatorValidate);
const devices = computed(() => props.challenge.device_challenges ?? []);
const emailDevice = computed(() => devices.value.find((d) => d.device_class === 'email') ?? null);
const sentTo = computed(() => props.challenge.email ?? (emailDevice.value?.challenge.email as string | undefined) ?? '');
const sent = computed(() => !validating.value || Boolean(props.challenge.response_errors) || !emailDevice.value);

const lead = computed(() => {
  if (emailDevice.value || !validating.value) {
    return sent.value ? `Код отправлен на ${sentTo.value}. Введите шесть цифр из письма.` : `Отправляем код на ${sentTo.value}…`;
  }
  return 'Введите код из приложения-аутентификатора.';
});

const WRONG: ReadonlySet<string> = new Set(['Code does not match', 'Invalid Token']);
const error = computed(() => {
  const raw = fieldError(props.challenge, 'code');
  if (!raw) return undefined;
  return WRONG.has(raw) ? 'Код не подошёл. Проверьте цифры или запросите новый.' : raw;
});

const choose = (): void => {
  if (emailDevice.value) emit('answer', { component: props.challenge.component, selected_challenge: emailDevice.value });
};
const submit = (): void => {
  if (code.value.length < 6 || props.sending) return;
  emit('answer', { component: props.challenge.component, code: code.value });
};

onMounted(() => {
  if (validating.value && emailDevice.value && !props.challenge.response_errors) choose();
});
watch(() => props.challenge, () => { code.value = ''; void nextTick(); });
</script>
