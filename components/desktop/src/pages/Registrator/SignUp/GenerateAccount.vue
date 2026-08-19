<template lang="pug">
div
  q-step(
    :name='store.steps.GenerateAccount',
    title='Установите пароль для входа',
    :done='store.isStepDone("GenerateAccount")'
  )
    .generate
      //- Ключ доступа больше не показывается и не выдаётся на руки: он создаётся
      //- здесь же, шифруется этим паролем и хранится в защищённом хранилище
      //- кооператива. Пайщик знает только пароль — им и входит.
      p.generate__hint Пароль понадобится для входа в кооператив с любого устройства. Цифровая подпись создаётся автоматически и хранится в зашифрованном виде — доступ к ней открывает только ваш пароль.

      BaseInput(
        v-model='password',
        label='Пароль',
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
        label='Повторите пароль',
        type='password',
        autocomplete='new-password',
        :error='repeatError',
        required,
        @keydown.enter.prevent='onRepeatEnter'
      )

      .generate__actions
        BaseButton(variant='ghost', @click='store.prev()')
          q-icon(name='arrow_back')
          span.q-ml-md назад

        BaseButton(
          variant='primary',
          :disabled='!canContinue',
          :loading='isLoading',
          @click='setAccount'
        )
          | Продолжить
</template>
<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useRegistratorStore } from 'src/entities/Registrator';
import { Classes } from '@coopenomics/sdk';
import { migrate, PASSWORD_POLICY_HINT, passwordPolicyErrors } from '@coopenomics/auth';
import { updateOpenReplayUser } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { FailAlert } from 'src/shared/api';

const store = useRegistratorStore();
const system = useSystemStore();

const api = useCreateUser();
const account = ref(store.state.account);
const isLoading = ref(false);

const password = ref('');
const repeatPassword = ref('');
const repeatRef = ref<{ focus: () => void } | null>(null);

if (
  !account.value.private_key ||
  !account.value.public_key ||
  !account.value.username
)
  account.value = new Classes.Account();

const email = computed(() => store.state.email);
const userData = computed(() => store.state.userData);

// Шаги q-stepper не размонтируются, поэтому введённый пароль «залипал» бы при
// возврате к шагу. Сбрасываем оба поля при каждом входе в шаг.
watch(
  () => store.state.step,
  (value) => {
    if (value === store.steps.GenerateAccount) {
      password.value = '';
      repeatPassword.value = '';
    }
  },
  { immediate: true },
);

const passwordError = computed(() => {
  if (!password.value) return '';
  return passwordPolicyErrors(password.value).join(', ');
});
const repeatError = computed(() =>
  repeatPassword.value && repeatPassword.value !== password.value
    ? 'Пароли не совпадают'
    : '',
);
const canContinue = computed(
  () =>
    passwordPolicyErrors(password.value).length === 0 &&
    repeatPassword.value === password.value,
);

const setAccount = async () => {
  isLoading.value = true;
  try {
    if (!store.state.accountCreated) {
      await api.createUser(email.value, userData.value, account.value);
      store.state.account = account.value;
      store.state.accountCreated = true;
    }

    // Пароль — сразу в контур CoopID: учётка входа + ключ, зашифрованный этим
    // паролем, в защищённом хранилище. Владение доказывается подписью только что
    // созданного ключа; `rotate: false` — ключ никому не показывался, ротировать
    // нечего (да и нельзя до принятия в пайщики). Дальше пайщик входит паролем.
    await migrate({
      email: email.value,
      privateKey: account.value.private_key,
      newPassword: password.value,
      rotate: false,
    });

    // Обновляем username в OpenReplay tracker после создания пользователя
    updateOpenReplayUser({
      username: account.value.username,
      coopname: system.info.coopname,
      cooperativeDisplayName: system.cooperativeDisplayName,
    });

    if (store.isBranched) store.goTo('SelectBranch');
    else store.goTo('ReadStatement');
  } catch (e: any) {
    // createUser падает из-за данных анкеты — возвращаем к ним. Установка пароля
    // (учётка уже создана) падает по сетевым причинам — остаёмся на шаге, пайщик
    // просто повторяет: провижининг пароля идемпотентен.
    if (!store.state.accountCreated) store.goTo('SetUserData');
    console.error(e);
    FailAlert(e);
  } finally {
    isLoading.value = false;
  }
};

/** Enter во втором поле = «Продолжить»: привычный набор без мыши. */
function onRepeatEnter(): void {
  if (canContinue.value && !isLoading.value) void setAccount();
}
</script>

<style scoped>
.generate {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  margin: var(--p-4, 16px) 0;
}
.generate__hint {
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink);
  margin: 0;
}
.generate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-top: var(--p-3, 12px);
}
</style>
