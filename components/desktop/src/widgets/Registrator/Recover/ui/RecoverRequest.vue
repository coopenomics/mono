<template>
  <AuthSplit
    :eyebrow="coopTitle"
    :title="$t('registrator.recoverRequest.title')"
    :lead="$t('registrator.recoverRequest.lead')"
    :quote="$t('registrator.recoverRequest.quote')"
    :step-eyebrow="$t('registrator.recoverRequest.stepEyebrow')"
    :heading="$t('registrator.recoverRequest.heading')"
    :text="$t('registrator.recoverRequest.text')"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <BaseBanner v-if="sent" variant="pos"> {{ $t('registrator.recoverRequest.sentBanner') }} </BaseBanner>
    <BaseForm v-else :loading="loading" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="email"
        :label="$t('registrator.recoverRequest.emailLabel')"
        type="email"
        autocomplete="email"
        :error="emailError"
        required
      />
      <BaseButton
        type="submit"
        variant="primary"
        block
        :loading="loading"
        :disabled="!isValidEmail"
      > {{ $t('registrator.recoverRequest.submit') }} </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useRecoverAccess } from 'src/features/User/RecoverAccess';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { t } from 'src/shared/i18n';

const { requestRecovery } = useRecoverAccess();
const { emailIsValid } = useCreateUser();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const email = ref('');
const loading = ref(false);
const sent = ref(false);
const errorMessage = ref('');

const isValidEmail = computed(() => emailIsValid(email.value));
const emailError = computed(() =>
  email.value && !isValidEmail.value ? t('registrator.recoverRequest.emailInvalid') : '',
);

const submit = async (): Promise<void> => {
  if (!isValidEmail.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await requestRecovery(email.value);
    // Исход всегда «письмо отправлено» — существование адреса наружу не раскрывается.
    sent.value = true;
  } catch (e: any) {
    errorMessage.value =
      e?.message || t('registrator.recoverRequest.submitError');
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>
