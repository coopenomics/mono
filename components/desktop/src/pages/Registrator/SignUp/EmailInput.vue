<template lang='pug'>
div
  q-step(:name='store.steps.EmailInput', title='Введите электронную почту', :done="store.isStepDone('EmailInput')")
    p Добро пожаловать в {{ coopTitle }}! Для начала регистрации, пожалуйста, введите вашу электронную почту:

    .email-input__field
      BaseInput(
        :model-value='email',
        type='email',
        label='Введите email',
        :readonly='inLoading',
        :error='emailError',
        autocomplete='email',
        @update:model-value='onEmailUpdate',
        @keypress.enter='setEmail'
      )

    BaseButton(
      variant='primary',
      :disabled='!isValidEmail || isEmailExist',
      :loading='inLoading',
      @click='setEmail'
    ) Продолжить
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { debounce } from 'quasar';
import { useRegistratorStore } from 'src/entities/Registrator';
import { env } from 'src/shared/config';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const store = useRegistratorStore();
const api = useCreateUser();

const coopTitle = computed(() => env.COOP_SHORT_NAME);
const email = ref(store.state.email);
const touched = ref<boolean>(Boolean(store.state.email));

watch(() => store.state.email, (val) => (email.value = val));

const inLoading = ref(false);
const isEmailExist = ref(false);

const isValidEmail = computed(() => api.emailIsValid(email.value));

const emailError = computed<string | undefined>(() => {
  if (!touched.value || !email.value) return undefined;
  if (!isValidEmail.value) return 'Введите корректный email';
  if (isEmailExist.value)
    return 'Пользователь с таким email уже существует. Войдите.';
  return undefined;
});

const checkEmailExists = debounce(async () => {
  inLoading.value = true;
  isEmailExist.value = await api.emailIsExist(email.value);
  inLoading.value = false;
}, 500);

function onEmailUpdate(val: string): void {
  email.value = val.trim();
  touched.value = true;
}

watch(email, () => {
  checkEmailExists();
});

const setEmail = () => {
  if (isValidEmail.value && !isEmailExist.value) {
    store.state.email = email.value;
    store.next();
  }
};
</script>

<style scoped>
.email-input__field {
  margin-top: var(--p-4, 16px);
  margin-bottom: var(--p-2, 8px);
  /* Поле уже, чем тело stepper-step. На широких карточках читается лучше
     если email-инпут не растягивается во всю ширину. */
  max-width: 360px;
}
</style>
