<template lang="pug">
.flow-password
  p.flow-stage__lead(v-if='challenge.pending_user')
    | {{ challenge.pending_user }} ·
    BaseButton(variant='ghost', size='sm', @click='emit("restart")') это не я
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
