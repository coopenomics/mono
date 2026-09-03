<template lang="pug">
.flow-identification
  BaseForm(:loading='sending', @submit='submit')
    BaseInput(
      v-model='uid',
      :label='label',
      :type='asksEmail ? "email" : "text"',
      :error='error',
      autocomplete='username',
      name='username',
      required,
      autofocus
    )
    BaseInput(
      v-if='asksPassword',
      v-model='password',
      label='Пароль',
      type='password',
      :error='passwordError',
      autocomplete='current-password',
      name='password',
      required
    )
    .flow-stage__actions
      BaseButton(variant='primary', type='submit', :loading='sending') {{ action }}
  template(v-if='sources.length')
    .flow-stage__divider или
    .flow-stage__stack
      BaseButton(
        v-for='source in sources',
        :key='source.name',
        :variant='source.promoted ? "primary" : "secondary"',
        @click='emit("source", source.challenge)'
      ) Войти через {{ source.name }}
  .flow-stage__links(v-if='challenge.enroll_url || challenge.recovery_url')
    BaseButton(v-if='challenge.enroll_url', variant='ghost', size='sm', @click='emit("flow", challenge.enroll_url)') Нет учётной записи?
    BaseButton(v-if='challenge.recovery_url', variant='ghost', size='sm', @click='emit("flow", challenge.recovery_url)') Не помню пароль
</template>

<script lang="ts" setup>
/**
 * Шаг «кто входит» (стадия `ak-stage-identification`).
 *
 * Спрашивается ровно то, что просит поток; ссылки на регистрацию и восстановление приходят
 * оттуда же — потоки настроены блюпринтом, дублировать адреса здесь незачем.
 */
import { computed, ref } from 'vue';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { fieldError, type FlowChallenge, type FlowSource } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{
  answer: [payload: Record<string, unknown>];
  flow: [url: string];
  source: [challenge: FlowChallenge];
}>();

const uid = ref('');
const password = ref('');
const asksEmail = computed(() => props.challenge.user_fields?.includes('email') ?? false);
const label = computed(() => (asksEmail.value ? 'Почта' : 'Имя аккаунта'));
const error = computed(() => fieldError(props.challenge, 'uid_field'));
const passwordError = computed(() => fieldError(props.challenge, 'password'));
const asksPassword = computed(() => props.challenge.password_fields === true);
// Надпись своя: поток присылает английское «Log in», а у стола кнопка входа — «Войти».
const action = computed(() => (asksPassword.value ? 'Войти' : 'Продолжить'));
const byPromoted = (a: FlowSource, b: FlowSource): number => Number(b.promoted ?? false) - Number(a.promoted ?? false);
const sources = computed(() => [...(props.challenge.sources ?? [])].sort(byPromoted));

const submit = (): void => {
  const answer: Record<string, unknown> = { component: props.challenge.component, uid_field: uid.value };
  if (asksPassword.value) answer.password = password.value;
  emit('answer', answer);
};
</script>
