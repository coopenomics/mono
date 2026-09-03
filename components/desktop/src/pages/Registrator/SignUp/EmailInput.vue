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

    //- Регистрация по карте пайщика — здесь, а не отдельным шагом в середине пути
    //- (решение владельца 03.09.2026). Смысл карты в том, чтобы не заполнять анкету
    //- заново: предлагать её после того, как человек всё ввёл руками, поздно.
    template(v-if='cardcoopEntryAvailable')
      .email-input__divider или
      BaseButton(variant='secondary', :disabled='inLoading', @click='startCardcoopEntry')
        template(#icon-left)
          q-icon(name='badge', size='18px')
        | Зарегистрироваться по карте пайщика
      p.email-input__note Карта перенесёт анкету из кооператива, где вас уже приняли: останется проверить данные и подписать заявление.
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { debounce } from 'quasar';
import { useRegistratorStore } from 'src/entities/Registrator';
import { env } from 'src/shared/config';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
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

/**
 * Доступен ли вход по карте пайщика. Спрашивается один раз при открытии шага: запрос
 * публичный, а молчаливый отказ означает «кнопки нет» — регистрация не должна падать
 * из-за расширения (NFR-3).
 */
const cardcoopEntryAvailable = ref(false);

onMounted(async () => {
  try {
    const { [Queries.Cardcoop.GetEntryAvailable.name]: available } = await client.Query(
      Queries.Cardcoop.GetEntryAvailable.query,
    );
    cardcoopEntryAvailable.value = Boolean(available);
  } catch {
    cardcoopEntryAvailable.value = false;
  }
});

/** Уводит на card.coop: дальше человека ведут карта и сервер, секретов в браузере нет. */
function startCardcoopEntry(): void {
  window.location.href = `${env.BACKEND_URL.replace(/\/+$/, '')}/v1/extensions/cardcoop/entry/start`;
}

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

/* Разделитель и пояснение — как на экране входа: две дороги, а не кнопка среди текста. */
.email-input__divider {
  margin: var(--p-4) 0 var(--p-3);
  max-width: 360px;
  text-align: center;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.email-input__note {
  margin: var(--p-2) 0 0;
  max-width: 360px;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
</style>
