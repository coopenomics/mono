<template lang="pug">
BaseDialog(v-model='open', title='Смена пароля', size='sm')
  .chpwd__form
    BaseBanner(variant='info')
      | После смены пароля все сессии будут завершены — войдите заново с новым
      | паролем. Цифровая подпись перевыпустится автоматически.
    BaseInput(
      v-model='oldPassword',
      label='Старый пароль',
      type='password',
      autocomplete='current-password',
      required,
      @keydown.enter.prevent='newRef?.focus()'
    )
    BaseInput(
      ref='newRef',
      v-model='newPassword',
      label='Новый пароль',
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
      label='Повторите новый пароль',
      type='password',
      autocomplete='new-password',
      :error='repeatError',
      required,
      @keydown.enter.prevent='onSubmitEnter'
    )
  template(#footer)
    BaseButton(variant='secondary', :disabled='saving', @click='open = false') Отмена
    BaseButton(
      variant='primary',
      :loading='saving',
      :disabled='!canSubmit',
      @click='onSubmit'
    ) Сменить пароль
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PASSWORD_POLICY_HINT, passwordPolicyErrors } from '@coopenomics/auth';
import { BaseBanner, BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useLogoutUser } from 'src/features/User/Logout';
import { useChangePassword } from '../model';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const route = useRoute();
const router = useRouter();
const { changePassword } = useChangePassword();
const { logout } = useLogoutUser();

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
  repeatPassword.value && repeatPassword.value !== newPassword.value ? 'Пароли не совпадают' : '',
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
    SuccessAlert('Пароль изменён. Войдите заново с новым паролем.');
    // Сессии отозваны сервером — локально выходим сами и ведём на вход, не
    // дожидаясь, пока протухший токен уронит первый же запрос.
    const coopname = route.params.coopname;
    await logout();
    void router.push({ name: 'signin', params: { coopname } });
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
