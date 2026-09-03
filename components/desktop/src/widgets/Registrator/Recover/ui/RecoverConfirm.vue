<template>
  <AuthCard
    title="Восстановление доступа"
    subtitle="Подтвердите смену ключа и задайте новый пароль"
  >
    <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
      <BaseBanner v-if="email" variant="neutral">
        Восстанавливаем доступ для {{ email }}
      </BaseBanner>

      <div v-if="twoFactorRequired" class="recover-confirm__field">
        <span class="recover-confirm__label">Код из приложения-аутентификатора</span>
        <OtpInput v-model="totp" :length="6" :error="totpError" />
      </div>

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
        :disabled="!isValid"
      >
        Восстановить доступ
      </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AuthCard>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AuthV2ErrorCode, PASSWORD_POLICY_HINT, passwordPolicyErrors } from '@coopenomics/auth';
import { useRecoverAccess } from 'src/features/User/RecoverAccess';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';

const props = defineProps<{
  /** Одноразовый токен восстановления из ссылки письма. */
  token: string;
  /** Coopname кооператива — для возврата на вход после успеха. */
  coopname: string;
}>();

const router = useRouter();
const { confirmRecovery, loadRecoveryContext } = useRecoverAccess();

// Почту и необходимость второго фактора отдаёт сервер по токену ссылки: пайщик их
// не вводит. Раньше почту спрашивали, хотя сервер её знает, а код просили у всех —
// у того, кто 2FA не подключал, экран упирался в тупик (владелец 03.09.2026).
const email = ref('');
const twoFactorRequired = ref(false);
const totp = ref('');
const newPassword = ref('');
const repeatPassword = ref('');
const loading = ref(false);
const errorMessage = ref('');

const isValidTotp = computed(() => !twoFactorRequired.value || totp.value.length === 6);
const isValidPassword = computed(
  () => passwordPolicyErrors(newPassword.value).length === 0,
);
const passwordsMatch = computed(
  () => !!repeatPassword.value && repeatPassword.value === newPassword.value,
);

const totpError = computed(() =>
  totp.value && totp.value.length !== 6 ? 'Код состоит из 6 цифр' : '',
);
const passwordError = computed(() =>
  newPassword.value ? passwordPolicyErrors(newPassword.value).join(', ') : '',
);
const repeatError = computed(() =>
  repeatPassword.value && !passwordsMatch.value ? 'Пароли не совпадают' : '',
);

const isValid = computed(
  () =>
    !!email.value &&
    isValidTotp.value &&
    isValidPassword.value &&
    passwordsMatch.value,
);

onMounted(async () => {
  try {
    const ctx = await loadRecoveryContext(props.token);
    email.value = ctx.email;
    twoFactorRequired.value = ctx.twoFactorRequired;
  } catch (e: any) {
    // Протухшая или чужая ссылка: форму показывать не на чем — говорим прямо.
    errorMessage.value =
      e?.message || 'Ссылка восстановления недействительна или истекла. Запросите восстановление заново.';
  }
});

/**
 * Довести пайщика до кабинета после того, как сессия CoopID уже построена.
 *
 * Один в один пост-логин обычного входа (`finishLogin` в LoginForm): сначала
 * перезагрузить рабочий стол под новую сессию — именно `loadDesktop` регистрирует
 * маршруты кооператива в роутере, — затем выбрать рабочий стол и перейти на его
 * страницу по умолчанию. Без этого шага любой переход упирался в стену: `/:coopname`
 * матчился в NotFound (маршрута ещё нет), а `/` показывал пустой index — там
 * буквально пустой div, в кабинет с него уводит guard, которому тоже нужен уже
 * загруженный стол (владелец 04.09.2026, две итерации подряд).
 *
 * Переход роутером, без перезапуска приложения: сессия живёт в этом же контексте.
 */
async function enterDesktop(): Promise<void> {
  const session = useSessionStore();
  const desktops = useDesktopStore();

  if (!session.isRegistrationComplete) {
    await router.push({ name: 'signup', params: { coopname: props.coopname } });
    return;
  }
  // Данные пользователя догружаются асинхронно; ждём их так же, как обычный вход.
  let attempts = 0;
  while (!session.loadComplete && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }
  try {
    await desktops.loadDesktop();
  } catch (e) {
    console.warn('[BOOTRACE] не удалось перезагрузить стол после восстановления:', e);
  }
  desktops.selectDefaultWorkspace(true);
  desktops.goToDefaultPage(router);
}

const submit = async (): Promise<void> => {
  if (!isValid.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await confirmRecovery({
      email: email.value,
      token: props.token,
      totp: twoFactorRequired.value ? totp.value : undefined,
      newPassword: newPassword.value,
    });
    SuccessAlert('Доступ восстановлен. Входим…');
    await enterDesktop();
  } catch (e: any) {
    // Ключ уже сменён, а войти следом не удалось: ссылка одноразовая и сожжена,
    // повторять здесь нечего. Оставлять пайщика на этой форме — тупик, уводим на
    // обычный вход новым паролём (владелец 03.09.2026).
    if (e?.code === AuthV2ErrorCode.RecoveryDoneLoginFailed) {
      SuccessAlert('Пароль изменён. Войдите новым паролём.');
      await router.push({ name: 'signin', params: { coopname: props.coopname } });
      return;
    }
    errorMessage.value =
      e?.message || 'Не удалось восстановить доступ. Проверьте код и попробуйте снова.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.recover-confirm__field {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.recover-confirm__label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
