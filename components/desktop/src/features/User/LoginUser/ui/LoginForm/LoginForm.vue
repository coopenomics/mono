<template>
  <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
    <!--
      Почта нужна только на шаге входа. На установке пароля она уже введена и
      никуда не денется — а оставленная на экране, делала оба шага неотличимыми:
      человек нажимал «Войти» и видел почти ту же форму, не понимая, что от него
      теперь хотят другого.
    -->
    <BaseInput
      v-if="mode === 'login'"
      v-model="email"
      label="Электронная почта"
      type="email"
      autocomplete="email"
      required
    />

    <!-- Шаг входа: единое поле — пароль или ключ доступа -->
    <template v-if="mode === 'login'">
      <BaseInput
        v-model="secret"
        label="Пароль или ключ доступа"
        type="password"
        autocomplete="current-password"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!secret || !email"
      >
        Войти
      </BaseButton>
    </template>

    <!-- Шаг 2FA: пароль и ключ приняты, сервер ждёт код второго фактора -->
    <template v-else-if="mode === 'twofactor'">
      <div class="login-2fa__field">
        <span class="login-2fa__label">{{ currentFactorLabel }}</span>
        <OtpInput
          ref="otpRef"
          v-model="otp"
          :length="6"
          :error="otpError"
          autofocus
          @complete="confirmFactor"
        />
      </div>
      <div v-if="currentFactor === 'email'" class="login-2fa__resend">
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="resendCooldown > 0 || loading"
          @click="resendEmail"
        >
          {{ resendCooldown > 0 ? `Отправить код повторно (${resendCooldown} с)` : 'Отправить код повторно' }}
        </BaseButton>
      </div>
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="otp.length !== 6"
      >
        Подтвердить
      </BaseButton>
      <BaseButton variant="secondary" block :disabled="loading" @click="backToLogin">
        Назад ко входу
      </BaseButton>
    </template>

    <!-- Шаг миграции: вошли по ключу — предлагаем задать пароль -->
    <template v-else>
      <BaseBanner variant="info">
        Взамен введённого ключа будет выпущен новый — он хранится в зашифрованном
        виде, и открывает его только ваш пароль. Старый ключ перестанет
        действовать, хранить его больше не нужно. Дальше вход — только по паролю.
      </BaseBanner>
      <BaseInput
        v-model="newPassword"
        label="Новый пароль"
        type="password"
        autocomplete="new-password"
        :hint="PASSWORD_POLICY_HINT"
        :error="passwordError"
        required
      />
      <BaseInput
        v-model="repeatPassword"
        label="Повторите пароль"
        type="password"
        autocomplete="new-password"
        :error="repeatError"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!canMigrate"
      >
        Задать пароль и войти
      </BaseButton>
    </template>
  </BaseForm>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { LocalStorage } from 'quasar';
import { useSessionStore } from 'src/entities/Session';
import { useLoginUser } from 'src/features/User/LoginUser';
import { useNotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';
import { FailAlert } from 'src/shared/api';
import { BaseBanner, BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { env, updateOpenReplayUser } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';
import { looksLikeWif } from 'src/shared/lib/utils/looksLikeWif';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import {
  AuthV2Error,
  AuthV2ErrorCode,
  PASSWORD_POLICY_HINT,
  passwordPolicyErrors,
  resendLoginEmailCode,
  warmUpAuthentik,
  type LoginFactorKind,
} from '@coopenomics/auth';

// Шаг формы наружу: заголовок карточки принадлежит не форме, а тому, кто её
// показывает, — а меняться он обязан вместе с шагом.
const emit = defineEmits<{
  'step-change': [step: 'login' | 'migrate' | 'twofactor'];
}>();

const router = useRouter();
const system = useSystemStore();
const session = useSessionStore();
const { showDialog } = useNotificationPermissionDialog();
const { migrateAndLogin, loginWithPassword, confirmLoginSecondFactor } = useLoginUser();

const email = ref('');
const secret = ref('');
const mode = ref<'login' | 'migrate' | 'twofactor'>('login');
const newPassword = ref('');
const repeatPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');

// 2FA-вход: challenge выдан сервером ПОСЛЕ проверки пароля и ключа — токены
// удержаны до подтверждения кодами. Факторы проходятся по очереди.
const challenge = ref<{ token: string; factors: LoginFactorKind[]; index: number } | null>(null);
const otp = ref('');
const otpError = ref('');
const otpRef = ref<InstanceType<typeof OtpInput> | null>(null);

/** Вернуть курсор в первую ячейку — после смены фактора и после неверного кода. */
function restartOtpEntry(): void {
  otp.value = '';
  void nextTick(() => otpRef.value?.focusCell(0));
}
const resendCooldown = ref(0);
let resendTimer: ReturnType<typeof setInterval> | null = null;

const currentFactor = computed<LoginFactorKind | null>(
  () => challenge.value?.factors[challenge.value.index] ?? null,
);
const currentFactorLabel = computed(() =>
  currentFactor.value === 'email'
    ? 'Код из письма, отправленного на вашу почту'
    : 'Код из приложения-аутентификатора',
);

function startResendCooldown(): void {
  resendCooldown.value = 60;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0 && resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
    }
  }, 1000);
}

onUnmounted(() => {
  if (resendTimer) clearInterval(resendTimer);
});

// Пока пайщик заполняет форму, открываем flow authentik и тянем метаданные OIDC.
// Оба запроса всё равно нужны при входе, но первое обращение к authentik заметно
// медленнее последующих — выполненные заранее, они уходят из времени ожидания.
onMounted(() => {
  if (env.COOPID_ISSUER) void warmUpAuthentik({ issuer: env.COOPID_ISSUER });
});

const passwordError = computed(() =>
  newPassword.value ? passwordPolicyErrors(newPassword.value).join(', ') : '',
);
const repeatError = computed(() =>
  repeatPassword.value && repeatPassword.value !== newPassword.value
    ? 'Пароли не совпадают'
    : '',
);
const canMigrate = computed(
  () =>
    passwordPolicyErrors(newPassword.value).length === 0 &&
    repeatPassword.value === newPassword.value,
);

function navigateToSavedUrl(): boolean {
  if (!process.env.CLIENT) return false;
  const redirectUrl = LocalStorage.getItem('redirectAfterLogin') as string;
  if (!redirectUrl) return false;
  LocalStorage.remove('redirectAfterLogin');
  try {
    if (redirectUrl.startsWith('#')) {
      void router.push(redirectUrl.substring(1));
    } else {
      const url = new URL(redirectUrl);
      void router.push(url.pathname + url.search);
    }
  } catch (e) {
    console.error('Error parsing URL, using direct navigation', e);
    window.location.href = redirectUrl;
  }
  return true;
}

/** Общий пост-логин: трекер, переход к регистрации/дашборду, диалог уведомлений. */
async function finishLogin(): Promise<void> {
  const desktops = useDesktopStore();
  updateOpenReplayUser({
    username: session.username,
    coopname: system.info.coopname,
    cooperativeDisplayName: system.cooperativeDisplayName,
  });

  if (!session.isRegistrationComplete) {
    desktops.setWorkspaceChanging(false);
    void router.push({ name: 'signup' });
  } else {
    let attempts = 0;
    const maxAttempts = 50;
    while (!session.loadComplete && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    try {
      await desktops.loadDesktop();
    } catch (e) {
      console.warn('[BOOTRACE] не удалось перезагрузить стол после входа:', e);
    }
    if (!navigateToSavedUrl()) {
      desktops.selectDefaultWorkspace(true);
      desktops.goToDefaultPage(router);
    }
    if (session.loadComplete) {
      desktops.setWorkspaceChanging(false);
    }
  }

  loading.value = false;
  setTimeout(() => {
    showDialog();
  }, 1000);
}

const submit = async (): Promise<void> => {
  errorMessage.value = '';

  // Шаг 2FA: подтвердить код текущего фактора.
  if (mode.value === 'twofactor') {
    await confirmFactor();
    return;
  }

  // Шаг миграции: задать пароль действующему пайщику и войти.
  if (mode.value === 'migrate') {
    if (!canMigrate.value) return;
    await runLogin(async () => {
      await migrateAndLogin({
        email: email.value,
        privateKey: secret.value,
        newPassword: newPassword.value,
      });
    });
    return;
  }

  // Шаг входа.
  if (!secret.value || !email.value) return;

  // Вставлен ключ доступа — значит пароля у пайщика ещё нет. Ведём на установку
  // пароля БЕЗ возможности пропустить: вход по одному ключу мы больше не даём,
  // иначе переход растянулся бы навсегда и пришлось бы вечно тянуть два контура.
  if (looksLikeWif(secret.value)) {
    mode.value = 'migrate';
    emit('step-change', 'migrate');
    return;
  }

  await runLogin(async () => {
    await loginWithPassword(email.value, secret.value);
  });
};

/** Обёртка входа: общий loading/ошибки + смена столов + пост-логин. */
async function runLogin(action: () => Promise<void>): Promise<void> {
  loading.value = true;
  const desktops = useDesktopStore();
  try {
    await action();
    // Оверлей смены стола — ТОЛЬКО после успешного входа. Он подменяет собой
    // router-view (default.vue: WindowLoader v-if / router-view v-else), то есть
    // размонтирует эту форму: включённый до action, он убивал переключение на шаг
    // второго фактора — challenge ловил уже мёртвый экземпляр, а при снятии
    // оверлея монтировалась свежая форма в режиме «login». Пока идёт проверка
    // пароля, статус показывает кнопка (:loading) — канон «не перекрывать экран».
    desktops.setWorkspaceChanging(true);
    await finishLogin();
  } catch (e: any) {
    loading.value = false;
    desktops.setWorkspaceChanging(false);

    // Не ошибка, а следующая ступень: сервер удержал токены до кода второго
    // фактора. Challenge приходит в details типизированной ошибки SDK.
    if (e instanceof AuthV2Error && e.code === AuthV2ErrorCode.SecondFactorRequired) {
      const details = (e.details ?? {}) as { challenge_token?: string; factors?: LoginFactorKind[] };
      if (details.challenge_token && details.factors?.length) {
        challenge.value = { token: details.challenge_token, factors: details.factors, index: 0 };
        otp.value = '';
        otpError.value = '';
        mode.value = 'twofactor';
        emit('step-change', 'twofactor');
        // Email-код первым фактором сервер уже отправил — сразу заводим отсчёт повтора.
        if (details.factors[0] === 'email') startResendCooldown();
        return;
      }
    }

    console.error(e);
    errorMessage.value =
      e?.message || 'Не удалось выполнить вход. Проверьте данные и попробуйте снова.';
    FailAlert(e);
  }
}

/** Подтвердить код текущего фактора; финальный фактор достраивает сессию и ведёт в кабинет. */
async function confirmFactor(): Promise<void> {
  if (!challenge.value || otp.value.length !== 6 || loading.value) return;
  loading.value = true;
  otpError.value = '';
  const desktops = useDesktopStore();
  try {
    const result = await confirmLoginSecondFactor(challenge.value.token, otp.value);
    if (result.done) {
      desktops.setWorkspaceChanging(true);
      challenge.value = null;
      await finishLogin();
      return;
    }
    // Фактор пройден, очередь следующего (email-код сервер отправил только сейчас).
    challenge.value = { ...challenge.value, index: challenge.value.index + 1 };
    restartOtpEntry();
    if (result.nextFactor === 'email') startResendCooldown();
    loading.value = false;
  } catch (e: any) {
    loading.value = false;
    if (e instanceof AuthV2Error && e.code === AuthV2ErrorCode.InvalidTwoFactorCode) {
      otpError.value = e.message;
      restartOtpEntry();
      return;
    }
    // Challenge истёк или сожжён перебором — начинаем вход заново.
    backToLogin();
    errorMessage.value =
      e?.message || 'Подтверждение входа не удалось. Войдите заново.';
    FailAlert(e);
  }
}

/** Повторно отправить email-код текущего challenge (сервер троттлит раз в минуту). */
async function resendEmail(): Promise<void> {
  if (!challenge.value || resendCooldown.value > 0) return;
  try {
    await resendLoginEmailCode(challenge.value.token);
    startResendCooldown();
  } catch (e) {
    FailAlert(e);
  }
}

/** Назад ко входу: challenge бросаем (истечёт сам), пароль вводится заново. */
function backToLogin(): void {
  challenge.value = null;
  otp.value = '';
  otpError.value = '';
  secret.value = '';
  mode.value = 'login';
  emit('step-change', 'login');
}
</script>

<style scoped>
.login-2fa__field {
  display: flex;
  flex-direction: column;
  /* Ячейки кода уже кнопки «Подтвердить» — по центру блок смотрится собранным,
     слева он выглядел прижатым и «не в полную ширину». */
  align-items: center;
  gap: var(--p-2, 8px);
}
.login-2fa__field :deep(.otp-input) {
  align-items: center;
}
.login-2fa__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.login-2fa__resend {
  display: flex;
  justify-content: center;
}
</style>
