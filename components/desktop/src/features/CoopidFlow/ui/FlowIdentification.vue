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
  //- Вторые дороги. Поток отдаёт свои адреса, только если кооперативу назначены потоки
  //- регистрации и восстановления; у CoopID их нет — вступление и восстановление живут
  //- страницами стола. Без ссылок экран был тупиком для забывшего пароль (03.09.2026).
  .flow-stage__links
    BaseButton(v-if='challenge.enroll_url', variant='ghost', size='sm', @click='emit("flow", challenge.enroll_url)') Нет учётной записи?
    BaseButton(v-else, variant='ghost', size='sm', @click='goDesk("signup")') Нет учётной записи?
    BaseButton(v-if='challenge.recovery_url', variant='ghost', size='sm', @click='emit("flow", challenge.recovery_url)') Не помню пароль
    BaseButton(v-else, variant='ghost', size='sm', @click='goDesk("recover")') Не помню пароль
</template>

<script lang="ts" setup>
/**
 * Шаг «кто входит» (стадия `ak-stage-identification`).
 *
 * Спрашивается ровно то, что просит поток; ссылки на регистрацию и восстановление приходят
 * оттуда же — потоки настроены блюпринтом, дублировать адреса здесь незачем.
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { fieldError, type FlowChallenge, type FlowSource } from 'src/shared/api/authentik-flow';

const router = useRouter();
const system = useSystemStore();
const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{
  answer: [payload: Record<string, unknown>];
  flow: [url: string];
  source: [challenge: FlowChallenge];
}>();

const uid = ref('');
const password = ref('');
const asksEmail = computed(() => props.challenge.user_fields?.includes('email') ?? false);
// Подпись та же, что в форме входа стола: человек проходит два экрана подряд и не должен
// гадать, одно ли это поле (замечание владельца 03.09.2026).
const label = computed(() => (asksEmail.value ? 'Электронная почта' : 'Имя аккаунта'));
const error = computed(() => fieldError(props.challenge, 'uid_field'));
const passwordError = computed(() => fieldError(props.challenge, 'password'));
const asksPassword = computed(() => props.challenge.password_fields === true);
// Надпись своя: поток присылает английское «Log in», а у стола кнопка входа — «Войти».
const action = computed(() => (asksPassword.value ? 'Войти' : 'Продолжить'));
const byPromoted = (a: FlowSource, b: FlowSource): number => Number(b.promoted ?? false) - Number(a.promoted ?? false);
const sources = computed(() => [...(props.challenge.sources ?? [])].sort(byPromoted));

/**
 * Уводит на страницу стола: вступление и восстановление доступа ведёт сам кооператив, а не
 * CoopID. Начатый вход при этом бросается — человеку он и не нужен, раз учётной записи нет.
 *
 * @param name — имя маршрута стола.
 */
const goDesk = (name: 'signup' | 'recover'): void => {
  void router.push({ name, params: { coopname: system.info.coopname } });
};

const submit = (): void => {
  const answer: Record<string, unknown> = { component: props.challenge.component, uid_field: uid.value };
  if (asksPassword.value) answer.password = password.value;
  emit('answer', answer);
};
</script>
