<template>
  <AuthCard
    title="Восстановление доступа"
    subtitle="Подтвердите смену ключа и задайте новый пароль"
  >
    <div v-if="finishing" class="recover-confirm__finishing">
      <q-spinner size="2em" color="primary" />
      <span class="recover-confirm__label">Входим…</span>
    </div>

    <BaseForm v-else :loading="loading" :error="errorMessage" @submit="submit">
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
import { loadUserContext } from 'src/processes/init-wallet/loadUserContext';
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
// Восстановление прошло, идёт вход и переход. Форму с этого момента не показываем
// вообще: она успевала вернуться на экран, пока guard ждал загрузки данных, и заново
// ругалась на уже сожжённый токен (владелец 04.09.2026).
const finishing = ref(false);
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
    // Уже подтвердили и уходим — токен законно сожжён, ошибку не показываем.
    if (finishing.value) return;
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

  // Тот же контекст пайщика, что поднимает фоновый init-wallet при обычном старте:
  // учётная запись + кошелёк принятого советом. Зовём общий шаг, а не свою копию —
  // копия уже разошлась однажды (аккаунт грузили, кошелёк нет) и в левом меню пропадала
  // карточка пайщика с кнопкой выхода. Без него же isRegistrationComplete всегда false,
  // и пайщика уносило на регистрацию, а кабинет догонял секундами позже.
  try {
    await loadUserContext();
  } catch (e) {
    console.warn('[BOOTRACE] не удалось поднять контекст пайщика после восстановления:', e);
  }

  if (!session.isRegistrationComplete) {
    await router.push({ name: 'signup', params: { coopname: props.coopname } });
    return;
  }

  // Данные пайщика уже на руках — снимаем флаг ожидания. Иначе навигационный guard
  // видит isAuth && !loadComplete и КРУТИТ ЦИКЛ ДО 5 СЕКУНД, ожидая init-wallet, который
  // в сценарии восстановления не запускается вовсе: маршрут всё это время не меняется
  // (владелец 04.09.2026, «форма зависает»).
  session.loadComplete = true;

  try {
    await desktops.loadDesktop();
  } catch (e) {
    console.warn('[BOOTRACE] не удалось перезагрузить стол после восстановления:', e);
  }
  desktops.selectDefaultWorkspace(true);

  // Переход ждём сами, а не через goToDefaultPage: тот снимает общий лоадер по таймеру
  // 500 мс, не дожидаясь навигации. Если маршрута по умолчанию нет (пайщика не принял
  // совет — стол не даёт ему видимых страниц), уходим на корень: его guard с загруженным
  // столом доведёт до регистрации.
  const target = desktops.getDefaultPageRoute() ?? { name: 'index' };
  await router.push(target);
  desktops.setWorkspaceChanging(false);
}

const submit = async (): Promise<void> => {
  if (!isValid.value) return;
  loading.value = true;
  errorMessage.value = '';

  // Прячем форму сразу по нажатию: дальше идут Argon2, confirm, вход и handshake — это
  // секунды. Прежний вариант поднимал общий isWorkspaceChanging, но его снимает
  // goToDefaultPage по таймеру 500 мс, не дожидаясь навигации, — форма возвращалась на
  // экран раньше, чем менялся маршрут. Своё состояние компонента от чужих таймеров не
  // зависит и снимается только вместе с ним.
  finishing.value = true;
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
    // Ссылка цела, ключ не тронут — возвращаем форму с сообщением.
    finishing.value = false;
    errorMessage.value =
      e?.message || 'Не удалось восстановить доступ. Проверьте код и попробуйте снова.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.recover-confirm__finishing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px) 0;
}
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
