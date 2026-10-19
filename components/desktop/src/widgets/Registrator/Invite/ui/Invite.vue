<template lang="pug">
//- Приглашение члена совета или пайщика: человек задаёт пароль и сразу входит.
//- Ключ подписи создаётся в браузере, шифруется этим паролем и хранится в
//- кооперативе — на руки его не выдаём, как и при регистрации.
AuthSplit.invite(
  :eyebrow='coopTitle',
  :title='$t("registrator.invite.title")',
  :lead='$t("registrator.invite.lead")',
  :quote='$t("registrator.invite.quote")',
  :step-eyebrow='$t("registrator.invite.title")',
  :heading='token ? $t("registrator.invite.passwordHeading") : $t("registrator.invite.linkHeading")',
  :text='headingText'
)
  template(#actions)
    AuthActions

  template(v-if='token')
    BaseBanner(v-if='tokenError', variant='neg') {{ tokenError }}
    template(v-else)
      BaseInput(
        v-model='password',
        :label='$t("registrator.invite.passwordLabel")',
        type='password',
        autocomplete='new-password',
        :hint='PASSWORD_POLICY_HINT',
        :error='passwordError',
        required,
        @keydown.enter.prevent='repeatRef?.focus()'
      )
      BaseInput(
        ref='repeatRef',
        v-model='repeat',
        :label='$t("registrator.invite.repeatPasswordLabel")',
        type='password',
        autocomplete='new-password',
        :error='repeatError',
        required,
        @keydown.enter.prevent='finish'
      )
      BaseButton(
        variant='primary',
        block,
        :disabled='!isValid || !email',
        :loading='loading',
        @click='finish'
      ) {{ $t('registrator.invite.submit') }}

  p.invite__instruction(v-else) {{ $t('registrator.invite.noToken') }}

  template(#foot)
    a.auth-link(href='#', @click.prevent='goToSignin') {{ $t('registrator.invite.goToSignIn') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PASSWORD_POLICY_HINT } from '@coopenomics/auth';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useResetKey } from 'src/features/User/ResetKey/model';
import { useEnterDesktop, useLoginUser } from 'src/features/User/LoginUser';
import { useNewPasswordForm } from 'src/features/Security/SetPassword';
import { FailAlert, SuccessAlert, extractGraphQLErrorMessages } from 'src/shared/api';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';

const route = useRoute();
const router = useRouter();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const { generateAccount } = useCreateUser();
const { resetKey, inviteRecipient } = useResetKey();
const { migrateAndLogin } = useLoginUser();
const { enterDesktop } = useEnterDesktop();
const { password, repeat, passwordError, repeatError, isValid } = useNewPasswordForm();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const email = ref('');
const tokenError = ref('');
const loading = ref(false);
const repeatRef = ref<{ focus: () => void } | null>(null);

// Ключ создаётся один раз на страницу: при повторе после сбоя он уже стоит в
// цепи, и повтор только доводит пароль (migrate идемпотентен).
const account = generateAccount();
let keyInChain = false;

const headingText = computed(() => {
  if (!token.value) return t('registrator.invite.linkText');
  return email.value ? t('registrator.invite.passwordText', { email: email.value }) : '';
});

onMounted(async () => {
  if (!token.value) return;
  try {
    email.value = await inviteRecipient({ token: token.value });
  } catch (e) {
    tokenError.value = extractGraphQLErrorMessages(e);
  }
});

const goToSignin = () => {
  router.push({ name: 'signin' });
};

const finish = async () => {
  if (!isValid.value || !email.value || loading.value) return;
  loading.value = true;
  try {
    if (!keyInChain) {
      await resetKey({ token: token.value, public_key: account.public_key });
      keyInChain = true;
    }
    await migrateAndLogin({
      email: email.value,
      privateKey: account.private_key,
      newPassword: password.value,
      rotate: false,
    });
    SuccessAlert(t('registrator.invite.passwordSetSuccess'));
    await enterDesktop();
  } catch (e: any) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.invite__instruction {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  margin: 0;
}
</style>
