<template lang="pug">
.set-vars(v-if='installStore.vars')
  //- ===== Наименование =====
  section.vars-section
    h3.vars-section__title {{ $t('installer.setVariablesForm.nameSectionTitle') }}
    .vars-section__note
      span.chip {{ $t('installer.setVariablesForm.opfChip') }}
      |  {{ $t('installer.setVariablesForm.opfNote') }}
    .vars-section__fields
      q-input(
        autofocus,
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.name',
        :label='$t("installer.setVariablesForm.nameLabel")',
        :placeholder='$t("installer.setVariablesForm.namePlaceholder")',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr',
        :label='$t("installer.setVariablesForm.fullAbbrLabel")',
        :placeholder='$t("installer.setVariablesForm.fullAbbrPlaceholder")',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr_genitive',
        :label='$t("installer.setVariablesForm.fullAbbrGenitiveLabel")',
        :placeholder='$t("installer.setVariablesForm.fullAbbrGenitivePlaceholder")',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr_dative',
        :label='$t("installer.setVariablesForm.fullAbbrDativeLabel")',
        :placeholder='$t("installer.setVariablesForm.fullAbbrDativePlaceholder")',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.short_abbr',
        :label='$t("installer.setVariablesForm.shortAbbrLabel")',
        :placeholder='$t("installer.setVariablesForm.shortAbbrPlaceholder")',
        :rules='[val => notEmpty(val)]'
      )

  //- ===== Устав =====
  section.vars-section
    h3.vars-section__title {{ $t('installer.setVariablesForm.statuteSectionTitle') }}
    p.vars-section__note {{ $t('installer.setVariablesForm.statuteNote') }}
    .vars-section__fields
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.statute_link',
        :label='$t("installer.setVariablesForm.statuteLinkLabel")',
        placeholder='https://example.com/statute.pdf',
        type='url',
        :rules='[val => notEmpty(val)]'
      )

  //- ===== Паспортные данные =====
  section.vars-section
    h3.vars-section__title {{ $t('installer.setVariablesForm.passportSectionTitle') }}
    p.vars-section__note {{ $t('installer.setVariablesForm.passportNote') }}
    q-toggle(
      v-model='installStore.vars.passport_request',
      :label='$t("installer.setVariablesForm.passportToggleLabel")',
      :true-value="'yes'",
      :false-value="'no'",
      color='primary'
    )

  //- ===== Контактная информация =====
  section.vars-section
    h3.vars-section__title {{ $t('installer.setVariablesForm.contactSectionTitle') }}
    p.vars-section__note {{ $t('installer.setVariablesForm.contactNote') }}
    .vars-section__fields
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.confidential_email',
        :label='$t("installer.setVariablesForm.confidentialEmailLabel")',
        type='email',
        :rules='[val => notEmpty(val)]'
      )

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
import { notEmpty } from 'src/shared/lib/utils';
import { ref, onMounted } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { t } from 'src/shared/i18n';

const installStore = useInstallCooperativeStore();
const { info } = useSystemStore();
const loading = ref(false);

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

.vars-section {
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.vars-section__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  margin: 0 0 var(--p-2, 8px);
}
.vars-section__note {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}
.vars-section__fields {
  display: flex;
  flex-direction: column;
  /* gap не задаём: reserve-hint-space у q-input уже разделяет поля (канон BaseForm). */
  margin-top: var(--p-3, 12px);
}

.set-vars__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  margin-top: var(--p-2, 8px);
}
</style>
