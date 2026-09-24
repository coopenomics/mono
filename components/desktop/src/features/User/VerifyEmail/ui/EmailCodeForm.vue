<template lang="pug">
//- Единая форма подтверждения адреса кодом: одна и та же в регистрации, в
//- профиле и в призыве кабинета. Отличается только то, что вокруг неё.
.email-code
  p.email-code__lead(v-if='sent')
    | {{ $t('user.emailCodeForm.sentTo') }}
    |
    strong {{ email }}
    | {{ $t('user.emailCodeForm.enterDigitsSuffix') }}
  p.email-code__lead(v-else)
    | {{ $t('user.emailCodeForm.sendingTo') }}
    |
    strong {{ email }}
    | …

  //- Шестая цифра подтверждает сама — тянуться к кнопке не нужно.
  OtpInput(
    v-model='code',
    :length='EMAIL_CODE_LENGTH',
    :error='error',
    :disabled='confirming || !sent',
    @complete='onConfirm'
  )

  .email-code__actions
    BaseButton(
      variant='ghost',
      size='sm',
      :loading='sending',
      :disabled='!canResend || confirming',
      @click='send'
    ) {{ canResend ? $t('user.emailCodeForm.resend') : $t(`user.emailCodeForm.resendCooldown`, { cooldown }) }}

    BaseButton(
      v-if='changeable',
      variant='ghost',
      size='sm',
      :disabled='confirming',
      @click='onChangeEmail'
    ) {{ $t('user.emailCodeForm.changeEmail') }}

  BaseButton(
    variant='primary',
    :loading='confirming',
    :disabled='code.length !== EMAIL_CODE_LENGTH || !sent',
    block,
    @click='onConfirm'
  ) {{ $t('user.emailCodeForm.confirm') }}
</template>

<script lang="ts" setup>
import { onMounted, toRef } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import { EMAIL_CODE_LENGTH, useEmailVerification } from '../model';

/**
 * Форма владеет всем циклом подтверждения — запросом письма, обратным отсчётом
 * и проверкой кода. Родителю остаётся решить, что делать после успеха: в
 * регистрации это переход к следующему шагу, в кабинете — обновление профиля.
 */
const props = withDefaults(
  defineProps<{
    /** Адрес, который подтверждается. */
    email: string;
    /** Показывать «Изменить адрес» — там, где адрес ещё можно поправить. */
    changeable?: boolean;
  }>(),
  { changeable: false },
);

const emit = defineEmits<{
  /** Код принят сервером: адрес подтверждён. */
  verified: [];
  /** Пайщик хочет вернуться к вводу адреса. */
  'change-email': [];
}>();

const { code, error, sent, sending, confirming, cooldown, canResend, send, confirm, reset } =
  useEmailVerification(toRef(props, 'email'));

// Письмо уходит сразу при открытии формы: пайщик уже нажал «Продолжить» или
// «Подтвердить» — отдельная кнопка «выслать код» была бы лишним щелчком.
onMounted(() => {
  void send();
});

async function onConfirm(): Promise<void> {
  if (await confirm()) emit('verified');
}

function onChangeEmail(): void {
  reset();
  emit('change-email');
}
</script>

<style scoped>
.email-code {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.email-code__lead {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
.email-code__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
</style>
