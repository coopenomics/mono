<template lang='pug'>
div(v-show='store.isStep("EmailInput")')
    //- Шаг состоит из двух фаз: ввод адреса и подтверждение кодом из письма.
    //- Отдельным шагом подтверждение делать нельзя — номера шагов лежат в
    //- persist'е стора у всех, кто уже идёт по регистрации, и вставка сдвинула
    //- бы их посреди пути.
    //- Одна колонка постоянной ширины: поле, кнопка и вторая дорога выстроены по левому
    //- краю и одинаковы по ширине. Раньше кнопки были разного размера и «или» висело
    //- посередине пустоты (замечание владельца 03.09.2026).
    .email-input(v-if='!confirming')
      p.email-input__lead {{ $t('registrator.emailInput.welcomeLead', { coopTitle }) }}

      //- Обёртка ловит автозаполнение браузера: оно не всегда доходит до поля
      //- обычным вводом, и проверка адреса не запускалась (замечание владельца 17.10.2026).
      .email-input__field(
        ref='fieldRef',
        @change='syncFromField',
        @focusout='syncFromField',
        @animationstart='syncFromField'
      )
        BaseInput(
          :model-value='email',
          type='email',
          :label='$t("registrator.emailInput.emailLabel")',
          :error='emailError',
          autocomplete='email',
          @update:model-value='onEmailUpdate',
          @keypress.enter='setEmail'
        )

      //- «Продолжить» загорается, только когда сервер ответил, что этот адрес свободен.
      //- Кнопка не подменяется на «Войти» на своём месте: ответ приходил под курсором,
      //- и нажатие уводило на вход раньше, чем человек видел подсказку.
      BaseButton(
        variant='primary',
        block,
        :disabled='!canContinue',
        :loading='showChecking',
        @click='setEmail'
      ) {{ $t('registrator.emailInput.submitAction') }}

      //- Адрес уже зарегистрирован: регистрация дальше не ведёт, человеку нужен
      //- вход или восстановление доступа. Код на такой адрес не отправляется.
      template(v-if='isEmailExist')
        BaseButton(variant='secondary', block, @click='goToSignIn') {{ $t('registrator.emailInput.signInAction') }}
        BaseButton(variant='ghost', block, @click='goToRecover') {{ $t('registrator.emailInput.recoverAction') }}

      //- Регистрация по карте кооператора — здесь, а не отдельным шагом в середине пути
      //- (решение владельца 03.09.2026). Смысл карты в том, чтобы не заполнять анкету
      //- заново: предлагать её после того, как человек ввёл всё руками, поздно.
      template(v-if='cardcoopEntryAvailable')
        .email-input__divider
          span.email-input__divider-word {{ $t('registrator.emailInput.orDivider') }}

        BaseButton(variant='secondary', block, @click='startCardcoopEntry')
          template(#icon-left)
            q-icon(name='badge', size='18px')
          | {{ $t('registrator.emailInput.cardcoopSignUpAction') }}

        p.email-input__note {{ $t('registrator.emailInput.cardcoopNote') }}

    //- Вход по карте кооператора ведёт на card.coop и возвращается уже с анкетой —
    //- почту там подтверждает сам эмитент карты, и эта фаза до него не доходит.
    .email-input(v-else)
      p.email-input__lead {{ $t('registrator.emailInput.codeSentLead') }}

      EmailCodeForm(
        :email='email',
        changeable,
        :purpose='Zeus.EmailVerificationPurpose.Registration',
        @verified='onVerified',
        @change-email='confirming = false'
      )
</template>

<script lang="ts" setup>
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCreateUser } from 'src/features/User/CreateUser';
import { debounce } from 'quasar';
import { useRegistratorStore } from 'src/entities/Registrator';
import { env } from 'src/shared/config';
import { client } from 'src/shared/api/client';
import { Queries, Zeus } from '@coopenomics/sdk';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { EmailCodeForm } from 'src/features/User/VerifyEmail';
import { t } from 'src/shared/i18n';

const store = useRegistratorStore();
const api = useCreateUser();
const router = useRouter();
const route = useRoute();

const coopTitle = computed(() => env.COOP_SHORT_NAME);
const email = ref(store.state.email);
const touched = ref<boolean>(Boolean(store.state.email));

/** Вторая фаза шага: адрес принят, ждём код из письма. */
const confirming = ref(false);

watch(() => store.state.email, (val) => (email.value = val));

/**
 * Ответ сервера о занятости адреса — вместе с адресом, к которому он относится.
 *
 * Прежде ответ жил отдельным флагом и номером попытки. Событие ввода во время
 * проверки (автозаполнение шлёт их по два) делало ответ устаревшим, флаг
 * оставался «свободен», и «Продолжить» уводило на шаг кода с занятым адресом
 * (продакшен, 17.10.2026). Теперь ответ годен, только пока адрес в поле тот же.
 * `unknown` — проверка не удалась: она подсказывает, а не запирает, сервер всё
 * равно откажет в коде на занятый адрес.
 */
type EmailCheckResult = 'free' | 'taken' | 'unknown';
const checked = ref<{ email: string; result: EmailCheckResult } | null>(null);
/** Сервер отвечает, занят ли адрес. */
const checking = ref(false);
/** Номер последней проверки: запоздавший ответ не перетирает свежий. */
let checkSeq = 0;

const isValidEmail = computed(() => api.emailIsValid(email.value));

/** Адрес собственной учётки, уже созданной на этом шаге: сервер назовёт его занятым. */
const isOwnEmail = computed(() => store.state.accountCreated && email.value === store.state.email);

const resultForCurrent = computed<EmailCheckResult | null>(() =>
  checked.value && checked.value.email === email.value ? checked.value.result : null,
);

const isEmailExist = computed(() => !isOwnEmail.value && resultForCurrent.value === 'taken');

/** «Продолжить» доступно только адресу, о котором сервер ответил «свободен». */
const canContinue = computed(
  () =>
    isValidEmail.value &&
    (isOwnEmail.value || resultForCurrent.value === 'free' || resultForCurrent.value === 'unknown'),
);

/**
 * Индикатор проверки на кнопке — только если ответ задерживается. Быстрый ответ
 * без него: кнопка просто загорается, а не мигает спиннером на каждую букву.
 */
const showChecking = ref(false);
let checkingTimer: ReturnType<typeof setTimeout> | undefined;
watch(checking, (now) => {
  clearTimeout(checkingTimer);
  if (!now) {
    showChecking.value = false;
    return;
  }
  // timing: ui — спиннер только на долгой проверке, короткая проходит без мигания
  checkingTimer = setTimeout(() => (showChecking.value = true), 400);
});
onBeforeUnmount(() => clearTimeout(checkingTimer));

const emailError = computed<string | undefined>(() => {
  if (!touched.value || !email.value) return undefined;
  if (!isValidEmail.value) return t('registrator.emailInput.invalidEmailError');
  if (isEmailExist.value)
    return t('registrator.emailInput.emailExistsError');
  return undefined;
});

/**
 * Спросить сервер, зарегистрирован ли адрес. О занятом адресе человек узнаёт
 * здесь, пока вводит почту, — до письма с кодом и анкеты.
 */
async function runEmailCheck(): Promise<void> {
  const value = email.value;
  if (!api.emailIsValid(value) || isOwnEmail.value) return;
  if (checked.value?.email === value) return;
  const seq = ++checkSeq;
  checking.value = true;
  let result: EmailCheckResult;
  try {
    result = (await api.emailIsExist(value)) ? 'taken' : 'free';
  } catch {
    result = 'unknown';
  }
  if (seq !== checkSeq) return;
  checked.value = { email: value, result };
  checking.value = false;
}

// timing: debounce — проверка адреса на паузе в наборе, а не на каждой букве
const checkEmailExists = debounce(runEmailCheck, 500);

function onEmailUpdate(val: string): void {
  const next = val.trim();
  touched.value = true;
  if (next === email.value) return;
  email.value = next;
  // Адрес правят — прежнее подтверждение к нему уже не относится.
  if (store.state.emailVerified) store.state.emailVerified = false;
}

watch(email, () => {
  // Проверка прежнего адреса больше не нужна: её ответ к новому не относится.
  checkSeq += 1;
  checking.value = false;
  checkEmailExists();
});

/**
 * Значение прямо из поля. Автозаполнение браузера не всегда доходит до поля
 * обычным вводом — адрес виден, а проверка не запускалась. Обёртка поля зовёт
 * это на `change`, уходе фокуса и анимации автозаполнения (`:-webkit-autofill`).
 */
const fieldRef = ref<HTMLElement | null>(null);
function syncFromField(): void {
  const native = fieldRef.value?.querySelector('input');
  if (native && native.value.trim() !== email.value) onEmailUpdate(native.value);
}

/**
 * Доступен ли вход по карте кооператора. Спрашивается один раз при открытии шага: запрос
 * публичный, а молчаливый отказ означает «кнопки нет» — регистрация не должна падать
 * из-за расширения (NFR-3).
 */
const cardcoopEntryAvailable = ref(false);

// realtime: нет источника — шаг ввода почты открыт гостю, лента доступна только вошедшему пайщику; доступность входа по карте читается один раз.
onMounted(async () => {
  // Адрес мог остаться с прошлого визита или прийти автозаполнением — проверяем
  // сразу, даже если он когда-то был подтверждён: с тех пор его мог занять другой.
  syncFromField();
  void runEmailCheck();
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

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}

function goToRecover(): void {
  void router.push({ name: 'recover', params: { coopname: route.params.coopname } });
}

const setEmail = () => {
  // Enter в поле приходит мимо неактивной кнопки — условие то же, что у неё.
  if (!canContinue.value) return;
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

/* Автозаполнение браузера само событий ввода не шлёт — пустая анимация на
   :-webkit-autofill даёт обёртке поля событие animationstart (см. syncFromField). */
.email-input__field :deep(input:-webkit-autofill) {
  animation-name: email-input-autofill;
  animation-duration: 1ms;
}

@keyframes email-input-autofill {
  from { opacity: 1; }
  to { opacity: 1; }
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
  background: var(--p-canvas);
}

.email-input__note {
  margin: 0;
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
</style>
