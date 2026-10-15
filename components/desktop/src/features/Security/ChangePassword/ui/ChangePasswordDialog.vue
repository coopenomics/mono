<template lang="pug">
BaseDialog(v-model='open', :title='$t("security.changePasswordDialog.title")', size='sm')
  .chpwd__form
    BaseBanner(variant='info')
      | {{ $t('security.changePasswordDialog.otherDevicesNote') }}
      | {{ $t('security.changePasswordDialog.thisDeviceNote') }}
    BaseInput(
      v-model='oldPassword',
      :label='$t("security.changePasswordDialog.oldPasswordLabel")',
      type='password',
      autocomplete='current-password',
      required,
      @keydown.enter.prevent='newRef?.focus()'
    )
    BaseInput(
      ref='newRef',
      v-model='newPassword',
      :label='$t("security.changePasswordDialog.newPasswordLabel")',
      type='password',
      autocomplete='new-password',
      :hint='PASSWORD_POLICY_HINT',
      :error='passwordError',
      required,
      @keydown.enter.prevent='repeatRef?.focus()'
    )
    BaseInput(
      ref='repeatRef',
      v-model='repeatPassword',
      :label='$t("security.changePasswordDialog.repeatPasswordLabel")',
      type='password',
      autocomplete='new-password',
      :error='repeatError',
      required,
      @keydown.enter.prevent='onSubmitEnter'
    )
  template(#footer)
    BaseButton(variant='secondary', :disabled='saving', @click='open = false') {{ $t('common.action.cancel') }}
    BaseButton(
      variant='primary',
      :loading='saving',
      :disabled='!canSubmit',
      @click='onSubmit'
    ) {{ $t('security.changePasswordDialog.submit') }}
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { PASSWORD_POLICY_HINT, passwordPolicyErrors } from '@coopenomics/auth';
import { BaseBanner, BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useChangePassword } from '../model';
import { t } from 'src/shared/i18n';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { changePassword } = useChangePassword();

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const oldPassword = ref('');
const newPassword = ref('');
const repeatPassword = ref('');
const saving = ref(false);
const newRef = ref<{ focus: () => void } | null>(null);
const repeatRef = ref<{ focus: () => void } | null>(null);

// Каждое открытие — с чистого листа: пароли не должны переживать закрытие диалога.
watch(open, (value) => {
  if (value) {
    oldPassword.value = '';
    newPassword.value = '';
    repeatPassword.value = '';
  }
});

const passwordError = computed(() =>
  newPassword.value ? passwordPolicyErrors(newPassword.value).join(', ') : '',
);
const repeatError = computed(() =>
  repeatPassword.value && repeatPassword.value !== newPassword.value ? t('security.changePasswordDialog.mismatchError') : '',
);
const canSubmit = computed(
  () =>
    !!oldPassword.value &&
    passwordPolicyErrors(newPassword.value).length === 0 &&
    repeatPassword.value === newPassword.value,
);

function onSubmitEnter(): void {
  if (canSubmit.value && !saving.value) void onSubmit();
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || saving.value) return;
  saving.value = true;
  try {
    await changePassword(oldPassword.value, newPassword.value);
    open.value = false;
    // Сессии отозваны сервером, но свою `changePassword` подняла обратно новым
    // паролём — выходить и вести на форму входа некого. Уходят только сеансы на
    // других устройствах, и об этом стоит сказать прямо: иначе пайщик узнает об
    // этом, когда его выбросит из кабинета на телефоне.
    SuccessAlert(t('security.changePasswordDialog.success'));
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.chpwd__form {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
</style>
