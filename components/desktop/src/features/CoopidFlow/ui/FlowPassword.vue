<template lang="pug">
.flow-password
  //- Кого опознали — строкой в один ряд с выходом из-под чужого имени. Раньше имя и «это не
  //- я» стояли в абзаце как текст, и кнопка ничего не делала: план потока в сессии
  //- authentik не сбрасывался (03.09.2026).
  .flow-password__who(v-if='challenge.pending_user')
    span.flow-password__who-label Входите как
    span.flow-password__who-name {{ challenge.pending_user }}
    BaseButton(variant='ghost', size='sm', :disabled='sending', @click='emit("restart")') Это не я
  BaseForm(:loading='sending', @submit='submit')
    BaseInput(
      v-model='password',
      label='Пароль',
      type='password',
      :error='error',
      autocomplete='current-password',
      name='password',
      required,
      autofocus
    )
    .flow-stage__actions
      BaseButton(variant='primary', type='submit', :loading='sending') Войти
  .flow-stage__links(v-if='challenge.recovery_url')
    BaseButton(variant='ghost', size='sm', @click='emit("flow", challenge.recovery_url)') Не помню пароль
</template>

<script lang="ts" setup>
/** Шаг пароля (стадия `ak-stage-password`): над полем — кого опознали на прошлом шаге. */
import { computed, ref } from 'vue';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { fieldError, type FlowChallenge } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{ answer: [payload: Record<string, unknown>]; flow: [url: string]; restart: [] }>();

const password = ref('');
const error = computed(() => fieldError(props.challenge, 'password'));
const submit = (): void => emit('answer', { component: props.challenge.component, password: password.value });
</script>

<style lang="scss" scoped>
.flow-password__who {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  margin-bottom: var(--p-3);
  min-width: 0;
}
.flow-password__who-label {
  color: var(--p-ink-3);
  flex: none;
}
.flow-password__who-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--p-ink);
  font-weight: 500;
}
</style>
