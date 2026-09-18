<template>
  <AuthSplit
    :eyebrow="coopTitle"
    title="Восстановление доступа"
    lead="Пришлём на почту ссылку — по ней вы зададите новый пароль и войдёте в кабинет."
    quote="Ссылка действует пять минут и открывается один раз."
    step-eyebrow="Восстановление"
    heading="Куда прислать ссылку"
    text="Введите электронную почту, на которую зарегистрирован аккаунт."
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <BaseBanner v-if="sent" variant="pos">
      Если этот адрес зарегистрирован, мы отправили на него ссылку для восстановления
      доступа. Откройте письмо и перейдите по ссылке — она действует 5 минут.
    </BaseBanner>
    <BaseForm v-else :loading="loading" :error="errorMessage" @submit="submit">
      <BaseInput
        v-model="email"
        label="Электронная почта"
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
      >
        Отправить ссылку
      </BaseButton>
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
  email.value && !isValidEmail.value ? 'Введите корректный email' : '',
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
      e?.message || 'Не удалось отправить запрос. Попробуйте позже.';
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};
</script>
