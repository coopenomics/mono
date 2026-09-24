<template lang="pug">
BaseCard(
  :title='$t("security.loginSecurityCard.title")',
  :subtitle='$t("security.loginSecurityCard.subtitle")'
)
  //- Факторы — надстройка над входом по паролю: без него их некуда спрашивать
  //- (сервер включение тоже отвергает). Гейт — как у PIN-кода ниже по странице.
  BaseBanner(v-if='!passwordReady', variant='info')
    | {{ $t('security.loginSecurityCard.unavailableNote') }}

  template(v-else-if='loading')
    q-skeleton(type='text', width='60%')

  template(v-else-if='factors')
    .lf__row
      .lf__row-main
        .lf__row-title
          q-icon(name='phonelink_lock', size='18px')
          span {{ $t('security.loginSecurityCard.totpTitle') }}
        p.lf__row-hint(v-if='!factors.totp_enrolled')
          | {{ $t('security.loginSecurityCard.totpNotConnected') }}
        p.lf__row-hint(v-else)
          | {{ $t('security.loginSecurityCard.totpConnected') }}
      .lf__row-side
        template(v-if='factors.totp_enrolled')
          q-toggle(
            :model-value='factors.totp_enabled',
            color='primary',
            :disable='saving',
            @update:model-value='onToggleTotp'
          )
        BaseButton(
          v-if='!factors.totp_enrolled',
          variant='primary',
          size='sm',
          @click='enrollOpen = true'
        ) {{ $t('security.loginSecurityCard.connect') }}
        BaseButton(
          v-else,
          variant='ghost',
          size='sm',
          @click='openCodeDialog("unenroll")'
        ) {{ $t('security.loginSecurityCard.disconnect') }}

    q-separator

    .lf__row
      .lf__row-main
        .lf__row-title
          q-icon(name='mark_email_read', size='18px')
          span {{ $t('security.loginSecurityCard.emailTitle') }}
        p.lf__row-hint(v-if='!factors.email_available')
          | {{ $t('security.loginSecurityCard.emailNotVerified') }}
        p.lf__row-hint(v-else)
          | {{ $t('security.loginSecurityCard.emailNote') }}
      .lf__row-side
        q-toggle(
          :model-value='factors.email_enabled',
          color='primary',
          :disable='saving || !factors.email_available',
          @update:model-value='onToggleEmail'
        )

  //- Подключение приложения: QR + секрет + подтверждение первым кодом.
  TotpEnrollDialog(v-model='enrollOpen', @activated='reload')

  //- Изменение TOTP-фактора и отключение приложения требуют действующий код —
  //- угнанная сессия не должна снимать защиту.
  BaseDialog(v-model='codeOpen', :title='codeDialogTitle', size='sm')
    .lf__code-dialog
      p.lf__row-hint {{ codeDialogHint }}
      //- Шестая цифра подтверждает сама — тянуться к кнопке не нужно.
      OtpInput(v-model='confirmCode', :length='6', :error='confirmError', @complete='onConfirmCode')
    template(#footer)
      BaseButton(variant='secondary', :disabled='saving', @click='codeOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='confirmCode.length !== 6',
        @click='onConfirmCode'
      ) {{ $t('common.action.confirm') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { api } from '../api';
import type { ILoginFactors } from '../model';
import TotpEnrollDialog from './TotpEnrollDialog.vue';
import { t } from 'src/shared/i18n';

const session = useSessionStore();

// Тот же серверный признак, что у карточки пароля: CoopID-сессия = вход по
// паролю уже случился; иначе смотрим Account.has_password.
const passwordReady = computed(
  () => session.isCoopIdSession || session.currentUserAccount?.has_password === true,
);

const loading = ref(true);
const saving = ref(false);
const factors = ref<ILoginFactors | null>(null);

const enrollOpen = ref(false);

/** Какое действие подтверждается кодом: тумблер TOTP-фактора или отключение приложения. */
type CodeAction = 'toggle-totp' | 'unenroll';
const codeOpen = ref(false);
const codeAction = ref<CodeAction>('toggle-totp');
const pendingTotpTarget = ref(false);
const confirmCode = ref('');
const confirmError = ref('');

const codeDialogTitle = computed(() =>
  codeAction.value === 'unenroll' ? t('security.loginSecurityCard.disconnectDialogTitle') : t('security.loginSecurityCard.confirmDialogTitle'),
);
const codeDialogHint = computed(() =>
  codeAction.value === 'unenroll'
    ? t('security.loginSecurityCard.disconnectDialogHint')
    : t('security.loginSecurityCard.confirmDialogHint'),
);

async function reload(): Promise<void> {
  loading.value = factors.value === null;
  try {
    factors.value = await api.loadLoginFactors();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// realtime: нет источника — факторы входа (пароль, код, приложение-аутентификатор) хранит провайдер входа, в ленте их нет; меняет их только этот экран, и после действия он перечитывает сам.
onMounted(reload);

function openCodeDialog(action: CodeAction, totpTarget = false): void {
  codeAction.value = action;
  pendingTotpTarget.value = totpTarget;
  confirmCode.value = '';
  confirmError.value = '';
  codeOpen.value = true;
}

function onToggleTotp(target: boolean): void {
  openCodeDialog('toggle-totp', target);
}

async function onToggleEmail(target: boolean): Promise<void> {
  if (!factors.value) return;
  saving.value = true;
  try {
    factors.value = await api.saveLoginFactors({
      totp_enabled: factors.value.totp_enabled,
      email_enabled: target,
    });
    SuccessAlert(target ? t('security.loginSecurityCard.emailEnabled') : t('security.loginSecurityCard.emailDisabled'));
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}

async function onConfirmCode(): Promise<void> {
  if (!factors.value || confirmCode.value.length !== 6 || saving.value) return;
  saving.value = true;
  confirmError.value = '';
  try {
    if (codeAction.value === 'unenroll') {
      await api.disableTwoFactor(confirmCode.value);
      SuccessAlert(t('security.loginSecurityCard.totpDisconnected'));
    } else {
      factors.value = await api.saveLoginFactors({
        totp_enabled: pendingTotpTarget.value,
        email_enabled: factors.value.email_enabled,
        code: confirmCode.value,
      });
      SuccessAlert(
        pendingTotpTarget.value
          ? t('security.loginSecurityCard.totpEnabled')
          : t('security.loginSecurityCard.totpDisabled'),
      );
    }
    codeOpen.value = false;
    await reload();
  } catch (e: any) {
    confirmError.value = e?.message || t('security.loginSecurityCard.wrongCode');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.lf__loading {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  color: var(--p-ink-2);
}
.lf__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-3) 0;
}
.lf__row-main {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.lf__row-title {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-weight: 500;
}
.lf__row-hint {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
.lf__row-side {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-shrink: 0;
}
.lf__code-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
</style>
