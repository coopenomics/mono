<template lang="pug">
.set-vars(v-if='installStore.vars')
  CooperativeVarsFields(v-model='installStore.vars', :show-errors='showErrors')

  .set-vars__actions
    BaseButton(variant='ghost', @click='back')
      q-icon(name='arrow_back', size='16px')
      span.q-ml-sm {{ $t('common.action.back') }}
    BaseButton(variant='primary', :loading='loading', @click='next')
      q-icon(name='done', size='16px')
      span.q-ml-sm {{ $t('installer.setVariablesForm.finishInstall') }}
</template>

<script lang="ts" setup>
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useInstallCooperative } from '../../model';
import { CooperativeVarsFields, hasMissingRequired } from 'src/features/Cooperative/EditVars';
import { ref, onMounted } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { t } from 'src/shared/i18n';

const installStore = useInstallCooperativeStore();
const { info } = useSystemStore();
const loading = ref(false);
// Ошибки пустых полей — после первой попытки завершить установку, не раньше.
const showErrors = ref(false);

onMounted(() => {
  // Инициализируем переменные если их нет
  if (!installStore.vars) {
    installStore.vars = {
      coopname: info.coopname,
      full_abbr: '',
      full_abbr_genitive: '',
      full_abbr_dative: '',
      short_abbr: '',
      website: window.location.origin,
      name: '',
      confidential_link: window.location.origin + '/privacy',
      confidential_email: '',
      contact_email: '',
      passport_request: 'no',
      statute_link: '',
      wallet_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      signature_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      privacy_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      user_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      participant_application: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
    };
  }
});

const back = () => {
  installStore.current_step = 'soviet';
};

const next = async () => {
  if (!installStore.vars || hasMissingRequired(installStore.vars)) {
    showErrors.value = true;
    return;
  }
  try {
    const { install } = useInstallCooperative();
    loading.value = true;
    await install();
    await useSystemStore().loadSystemInfo();

    loading.value = false;
    installStore.is_finish = true;
    installStore.wif = '';
    installStore.soviet = [];
    installStore.vars = undefined;
    installStore.current_step = 'key';

    SuccessAlert(t('installer.setVariablesForm.installSuccess'));
  } catch (e: any) {
    FailAlert(e);
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.set-vars {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.set-vars__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  margin-top: var(--p-2, 8px);
}
</style>
