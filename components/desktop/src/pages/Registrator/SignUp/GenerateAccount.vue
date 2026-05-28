<template lang="pug">
div
  q-step(
    :name='store.steps.GenerateAccount',
    title='Получите приватный ключ и надежно сохраните его для цифровой подписи',
    :done='store.isStepDone("GenerateAccount")'
  )
    .generate
      p.generate__hint Приватный ключ используется для входа в систему и подписи документов. Мы рекомендуем сохранить его в бесплатном менеджере паролей, таком как
        a.generate__link(href='https://bitwarden.com/download', target='_blank') Bitwarden
        | .

      .generate__field(ref='privateKeyFieldRef' v-if='account.private_key')
        BaseInput(
          :model-value='account.private_key',
          label='Приватный ключ',
          mono,
          readonly
        )
          template(#append)
            q-btn(flat dense round icon='content_copy' size='sm' @click='copyMnemonic')

      BaseCheckbox(v-model='i_save')
        | Я сохранил ключ в надёжном месте

      .generate__actions
        BaseButton(variant='ghost', @click='store.prev()')
          i.fa.fa-arrow-left
          span.q-ml-md назад

        BaseButton(
          variant='primary',
          :disabled='!i_save',
          :loading='isLoading',
          @click='setAccount'
        )
          | Продолжить
          q-tooltip подтвердите сохранение ключа для продолжения
</template>
<script lang="ts" setup>
import { ref, computed, nextTick, watch } from 'vue';
import { useCreateUser } from 'src/features/User/CreateUser';
import { copyToClipboard } from 'quasar';
import { useRegistratorStore } from 'src/entities/Registrator';
import { SuccessAlert } from 'src/shared/api';
import { Classes } from '@coopenomics/sdk';
import { updateOpenReplayUser } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';

const store = useRegistratorStore();
const system = useSystemStore();

import { FailAlert } from 'src/shared/api';

const api = useCreateUser();
const i_save = ref(false);
const account = ref(store.state.account);
const privateKeyFieldRef = ref<HTMLElement | null>(null);
const isLoading = ref(false);

if (
  !account.value.private_key ||
  !account.value.public_key ||
  !account.value.username
)
  account.value = new Classes.Account();

const email = computed(() => store.state.email);
const userData = computed(() => store.state.userData);

// Автоматическое выделение приватного ключа при его генерации
watch(
  () => account.value.private_key,
  (newKey) => {
    if (newKey) {
      void nextTick(() => {
        const input = privateKeyFieldRef.value?.querySelector('input');
        input?.select();
      });
    }
  },
  { immediate: true },
);

const copyMnemonic = () => {
  const toCopy = `${account.value.private_key}`;

  copyToClipboard(toCopy)
    .then(() => {
      SuccessAlert('Приватный ключ скопирован в буфер обмена');
    })
    .catch((e) => {
      console.log(e);
    });
};

const setAccount = async () => {
  isLoading.value = true;
  try {
    await api.createUser(email.value, userData.value, account.value);
    store.state.account = account.value;

    // Обновляем username в OpenReplay tracker после создания пользователя
    updateOpenReplayUser({
      username: account.value.username,
      coopname: system.info.coopname,
      cooperativeDisplayName: system.cooperativeDisplayName,
    });

    if (store.isBranched) store.goTo('SelectBranch');
    else store.goTo('ReadStatement');
  } catch (e: any) {
    store.goTo('SetUserData');
    console.error(e);
    FailAlert(e);
  } finally {
    isLoading.value = false;
  }
};
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
.generate__link {
  margin-left: var(--p-1, 4px);
  color: var(--p-primary);
  text-decoration: none;
}
.generate__link:hover {
  text-decoration: underline;
}
.generate__field {
  width: 100%;
}
.generate__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-top: var(--p-3, 12px);
}
</style>
