<template lang="pug">
BaseDialog(v-model='visible', title='Подключение приложения-аутентификатора', size='sm')
  .totp-enroll
    template(v-if='loadingChallenge')
      .totp-enroll__loading
        q-spinner(size='24px')
        span Готовим секрет…

    template(v-else-if='challenge')
      p.totp-enroll__hint
        | Отсканируйте QR-код приложением (Google Authenticator, Aegis, 1Password …)
        | или введите секрет вручную, затем подтвердите первым кодом.
      .totp-enroll__qr(v-if='qrDataUrl')
        img(:src='qrDataUrl', alt='QR-код для приложения-аутентификатора', width='180', height='180')
      .totp-enroll__secret
        span.totp-enroll__secret-label Секрет для ручного ввода
        code.totp-enroll__secret-value {{ challenge.secret }}
      .totp-enroll__code
        span.totp-enroll__secret-label Код из приложения
        OtpInput(v-model='code', :length='6', :error='codeError')

  template(#footer)
    BaseButton(variant='secondary', :disabled='activating', @click='visible = false') Отмена
    BaseButton(
      variant='primary',
      :loading='activating',
      :disabled='code.length !== 6 || !challenge',
      @click='onActivate'
    ) Подтвердить
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { api } from '../api';
import type { ITwoFactorEnrollment } from '../model';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  /** Приложение подключено и подтверждено первым кодом. */
  activated: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const loadingChallenge = ref(false);
const challenge = ref<ITwoFactorEnrollment | null>(null);
const qrDataUrl = ref('');
const code = ref('');
const codeError = ref('');
const activating = ref(false);

// Секрет выпускается при каждом открытии заново: до подтверждения первым кодом он
// «ожидает активации», перевыпуск безопасен и не трогает уже включённый фактор.
watch(visible, async (open) => {
  if (!open) {
    challenge.value = null;
    qrDataUrl.value = '';
    code.value = '';
    codeError.value = '';
    return;
  }
  loadingChallenge.value = true;
  try {
    challenge.value = await api.enrollTwoFactor();
    qrDataUrl.value = await QRCode.toDataURL(challenge.value.otpauth_uri, { margin: 1, width: 360 });
  } catch (e) {
    FailAlert(e);
    visible.value = false;
  } finally {
    loadingChallenge.value = false;
  }
});

async function onActivate(): Promise<void> {
  if (!challenge.value || code.value.length !== 6) return;
  activating.value = true;
  codeError.value = '';
  try {
    await api.activateTwoFactor(code.value);
    SuccessAlert('Приложение-аутентификатор подключено');
    emit('activated');
    visible.value = false;
  } catch (e: any) {
    codeError.value = e?.message || 'Неверный код';
  } finally {
    activating.value = false;
  }
}
</script>

<style scoped>
.totp-enroll {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.totp-enroll__loading {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  color: var(--p-ink-2);
}
.totp-enroll__hint {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
.totp-enroll__qr {
  display: flex;
  justify-content: center;
}
.totp-enroll__qr img {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: #fff; /* QR обязан оставаться контрастным и в тёмной теме */
}
.totp-enroll__secret,
.totp-enroll__code {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.totp-enroll__secret-label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.totp-enroll__secret-value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  word-break: break-all;
  padding: var(--p-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}
</style>
