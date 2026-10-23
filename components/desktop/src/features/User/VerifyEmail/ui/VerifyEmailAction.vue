<template lang="pug">
.verify-email
  //- Статус рядом с самим адресом (профиль): пайщик должен видеть, подтверждён
  //- он или нет, а не догадываться по наличию кнопки.
  BaseChip(v-if='showStatus', :variant='isVerified ? "pos" : "warn"', size='sm')
    | {{ isVerified ? $t('user.verifyEmailAction.verified') : $t('user.verifyEmailAction.notVerified') }}

  BaseButton(
    v-if='!isVerified && email',
    variant='secondary',
    size='sm',
    @click='dialogOpen = true'
  ) {{ $t('common.action.confirm') }}

  BaseDialog(v-model='dialogOpen', :title='$t("user.verifyEmailAction.dialogTitle")', size='sm')
    EmailCodeForm(v-if='dialogOpen', :email='email', @verified='onVerified')
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { BaseButton, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { SuccessAlert } from 'src/shared/api';
import { loadUserContext } from 'src/processes/init-wallet/loadUserContext';
import { useAccountEmail } from '../model';
import EmailCodeForm from './EmailCodeForm.vue';
import { t } from 'src/shared/i18n';

withDefaults(
  defineProps<{
    /** Показывать чип «Подтверждена / Не подтверждена» рядом с кнопкой. */
    showStatus?: boolean;
  }>(),
  { showStatus: false },
);

const { email, isVerified } = useAccountEmail();
const dialogOpen = ref(false);

async function onVerified(): Promise<void> {
  dialogOpen.value = false;
  SuccessAlert(t('user.verifyEmailAction.success'));
  // Признак живёт на сервере — перечитываем аккаунт, иначе чип остался бы
  // «Не подтверждена» до перезагрузки страницы.
  try {
    await loadUserContext();
  } catch (e) {
    console.warn('[VERIFY-EMAIL] не удалось обновить аккаунт после подтверждения', e);
  }
}
</script>

<style scoped>
.verify-email {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
</style>
