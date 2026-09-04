<template lang='pug'>
div
  q-step(:name='store.steps.EmailInput', title='Введите электронную почту', :done="store.isStepDone('EmailInput')")
    //- Шаг состоит из двух фаз: ввод адреса и подтверждение кодом из письма.
    //- Отдельным шагом подтверждение делать нельзя — номера шагов лежат в
    //- persist'е стора у всех, кто уже идёт по регистрации, и вставка сдвинула
    //- бы их посреди пути.
    //- Одна колонка постоянной ширины: поле, кнопка и вторая дорога выстроены по левому
    //- краю и одинаковы по ширине. Раньше кнопки были разного размера и «или» висело
    //- посередине пустоты (замечание владельца 03.09.2026).
    .email-input(v-if='!confirming')
      p.email-input__lead Добро пожаловать в {{ coopTitle }}! Для начала регистрации введите вашу электронную почту.

      BaseInput(
        :model-value='email',
        type='email',
        label='Электронная почта',
        :readonly='inLoading',
        :error='emailError',
        autocomplete='email',
        @update:model-value='onEmailUpdate',
        @keypress.enter='setEmail'
      )

      BaseButton(
        variant='primary',
        block,
        :disabled='!isValidEmail || isEmailExist',
        :loading='inLoading',
        @click='setEmail'
      ) Продолжить

      //- Регистрация по карте пайщика — здесь, а не отдельным шагом в середине пути
      //- (решение владельца 03.09.2026). Смысл карты в том, чтобы не заполнять анкету
      //- заново: предлагать её после того, как человек ввёл всё руками, поздно.
      template(v-if='cardcoopEntryAvailable')
        .email-input__divider
          span.email-input__divider-word или

        BaseButton(variant='secondary', block, :disabled='inLoading', @click='startCardcoopEntry')
          template(#icon-left)
            q-icon(name='badge', size='18px')
          | Зарегистрироваться по карте пайщика

        p.email-input__note Анкета перенесётся из кооператива, где вас уже приняли: останется проверить данные и подписать заявление.

    //- Вход по карте пайщика ведёт на card.coop и возвращается уже с анкетой —
    //- почту там подтверждает сам эмитент карты, и эта фаза до него не доходит.
    .email-input(v-else)
      p.email-input__lead Мы отправили код на указанный адрес — так мы убеждаемся, что письма кооператива до вас дойдут.

      EmailCodeForm(
        :email='email',
        changeable,
        @verified='onVerified',
        @change-email='confirming = false'
      )
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
import { EmailCodeForm } from 'src/features/User/VerifyEmail';

const store = useRegistratorStore();
const api = useCreateUser();

const coopTitle = computed(() => env.COOP_SHORT_NAME);
const email = ref(store.state.email);
const touched = ref<boolean>(Boolean(store.state.email));

/** Вторая фаза шага: адрес принят, ждём код из письма. */
const confirming = ref(false);

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
  // Адрес правят — прежнее подтверждение к нему уже не относится.
  if (store.state.emailVerified) store.state.emailVerified = false;
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
  if (!isValidEmail.value || isEmailExist.value) return;
  store.state.email = email.value;
  // Подтверждённый адрес не переспрашиваем: пайщик мог вернуться на шаг назад
  // или обновить страницу — код в письме не бесконечен, а его терпение тем более.
  if (store.state.emailVerified) {
    store.next();
    return;
  }
  confirming.value = true;
};

function onVerified(): void {
  store.state.emailVerified = true;
  confirming.value = false;
  store.next();
}
</script>

<style lang="scss" scoped>
/* Форма шага — одна колонка: поле и обе кнопки одной ширины, зазоры одинаковые.
   Ширина ограничена: на широкой карточке растянутое во всю ширину поле ввода почты
   читается хуже. */
.email-input {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  max-width: 360px;
  margin-top: var(--p-4);
}

.email-input__lead {
  margin: 0;
  color: var(--p-ink-2);
}

/* Разделитель — линия с надписью по центру, а не текст в пустоте */
.email-input__divider {
  position: relative;
  text-align: center;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    border-top: 1px solid var(--p-line);
  }
}

.email-input__divider-word {
  position: relative;
  padding: 0 var(--p-3);
  background: var(--p-surface);
}

.email-input__note {
  margin: 0;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
</style>
