<template lang="pug">
BaseCard(
  title='Подтверждение входа',
  subtitle='Дополнительный код при входе по паролю — даже зная пароль, войти без него нельзя.'
)
  template(v-if='loading')
    .lf__loading
      q-spinner(size='20px')
      span Загружаем настройки…

  template(v-else-if='factors')
    .lf__row
      .lf__row-main
        .lf__row-title
          q-icon(name='phonelink_lock', size='18px')
          span Код из приложения-аутентификатора
        p.lf__row-hint(v-if='!factors.totp_enrolled')
          | Приложение ещё не подключено. Подключите его, чтобы запрашивать код при входе.
        p.lf__row-hint(v-else)
          | Приложение подключено. Код запрашивается после ввода пароля.
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
        ) Подключить
        BaseButton(
          v-else,
          variant='ghost',
          size='sm',
          @click='openCodeDialog("unenroll")'
        ) Отключить приложение

    q-separator

    .lf__row
      .lf__row-main
        .lf__row-title
          q-icon(name='mark_email_read', size='18px')
          span Код на электронную почту
        p.lf__row-hint(v-if='!factors.email_available')
          | Почта не подтверждена — сначала подтвердите её в профиле.
        p.lf__row-hint(v-else)
          | Одноразовый код придёт на вашу почту после ввода пароля.
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
      OtpInput(v-model='confirmCode', :length='6', :error='confirmError')
    template(#footer)
      BaseButton(variant='secondary', :disabled='saving', @click='codeOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='confirmCode.length !== 6',
        @click='onConfirmCode'
      ) Подтвердить
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { api } from '../api';
import type { ILoginFactors } from '../model';
import TotpEnrollDialog from './TotpEnrollDialog.vue';

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
  codeAction.value === 'unenroll' ? 'Отключение приложения' : 'Подтверждение изменения',
);
const codeDialogHint = computed(() =>
  codeAction.value === 'unenroll'
    ? 'Введите код из приложения, чтобы отключить его. Код при входе перестанет запрашиваться.'
    : 'Введите код из приложения-аутентификатора, чтобы подтвердить изменение.',
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
    SuccessAlert(target ? 'Код на почту при входе включён' : 'Код на почту при входе отключён');
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}

async function onConfirmCode(): Promise<void> {
  if (!factors.value || confirmCode.value.length !== 6) return;
  saving.value = true;
  confirmError.value = '';
  try {
    if (codeAction.value === 'unenroll') {
      await api.disableTwoFactor(confirmCode.value);
      SuccessAlert('Приложение-аутентификатор отключено');
    } else {
      factors.value = await api.saveLoginFactors({
        totp_enabled: pendingTotpTarget.value,
        email_enabled: factors.value.email_enabled,
        code: confirmCode.value,
      });
      SuccessAlert(
        pendingTotpTarget.value
          ? 'Код из приложения при входе включён'
          : 'Код из приложения при входе отключён',
      );
    }
    codeOpen.value = false;
    await reload();
  } catch (e: any) {
    confirmError.value = e?.message || 'Неверный код';
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
