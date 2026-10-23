<template>
  <AuthSplit
    :eyebrow="coopTitle"
    :title="$t('registrator.lostKey.title')"
    :lead="$t('registrator.lostKey.lead')"
    :quote="$t('registrator.lostKey.quote')"
    :step-eyebrow="$t('registrator.lostKey.title')"
    :heading="$t('registrator.lostKey.heading')"
    :text="$t('registrator.lostKey.text')"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <BaseForm :loading="loading" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="email"
        :label="$t('registrator.lostKey.emailLabel')"
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
      > {{ $t('registrator.lostKey.submit') }} </BaseButton>
    </BaseForm>
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useLostKey } from 'src/features/User/LostKey/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { t } from 'src/shared/i18n';

const router = useRouter();
const { startResetKey } = useLostKey();
const { emailIsValid } = useCreateUser();
const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const email = ref('');
const loading = ref(false);
const errorMessage = ref('');

const isValidEmail = computed(() => emailIsValid(email.value));
const emailError = computed(() =>
  email.value && !isValidEmail.value ? t('registrator.lostKey.emailInvalid') : '',
);

const submit = async (): Promise<void> => {
  if (!isValidEmail.value) return;
  loading.value = true;
  errorMessage.value = '';
  try {
    await startResetKey({ email: email.value });
    void router.push({ name: 'resetkey' });
  } catch (e: any) {
    errorMessage.value = e?.message || t('registrator.lostKey.submitError');
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>
