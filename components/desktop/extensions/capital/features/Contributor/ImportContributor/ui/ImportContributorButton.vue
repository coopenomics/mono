<template lang="pug">
div
  //- Canon header-кнопка: на мобильном — иконка-only + tooltip.
  q-btn(
    @click='showDialog = true',
    :color='isMobile ? "accent" : "primary"',
    :flat='isMobile',
    :dense='isMobile',
    :size='isMobile ? "sm" : undefined',
    :loading='loading',
    icon='add',
    :label='isMobile ? undefined : $t("common.action.add")',
    no-wrap
  )
    q-tooltip(v-if='isMobile') {{ $t('capital.importContributorButton.buttonLabel') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.importContributorButton.dialogTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-md(
      :handler-submit='handleImportContributor',
      :is-submitting='isSubmitting',
      :button-submit-txt='$t("capital.importContributorButton.submit")',
      :button-cancel-txt='$t("common.action.cancel")',
      @cancel='clear'
      style="width: 600px; max-width: 100% !important;"
    )
      q-input(
        v-model='formData.username'
        :label='$t("capital.importContributorButton.usernameLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.usernameRequired")]'
        outlined
      )

      q-input(
        v-model='formData.contribution_amount'
        :label='$t("capital.importContributorButton.amountLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.amountRequired")]'
        outlined
      )
        template(#append)
          span.text-grey-7 {{ info.symbols.root_govern_symbol }}

      q-input(
        v-model='formData.contributor_contract_number'
        :label='$t("capital.importContributorButton.contractNumberLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.contractNumberRequired")]'
        outlined
      )

      q-input(
        v-model='formData.contributor_contract_created_at'
        :label='$t("capital.importContributorButton.contractDateLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.contractDateRequired")]'
        outlined
      )

      q-input(
        v-model='formData.blagorost_agreement_number'
        :label='$t("capital.importContributorButton.agreementNumberLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.agreementNumberRequired")]'
        outlined
      )

      q-input(
        v-model='formData.blagorost_agreement_created_at'
        :label='$t("capital.importContributorButton.agreementDateLabel")'
        :rules='[(val) => !!val || $t("capital.importContributorButton.agreementDateRequired")]'
        outlined
      )

      q-input(
        v-model='formData.memo'
        :label='$t("capital.importContributorButton.noteLabel")'
        outlined
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useImportContributor } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize } from 'src/shared/hooks';
import { t } from '../../../../i18n';

const { importContributor } = useImportContributor();
const { info } = useSystemStore();
const { isMobile } = useWindowSize();

const showDialog = ref(false);
const isSubmitting = ref(false);
const loading = ref(false);

const formData = ref({
  username: '',
  contribution_amount: '',
  contributor_contract_number: '',
  contributor_contract_created_at: '',
  blagorost_agreement_number: '',
  blagorost_agreement_created_at: '',
  memo: '',
});

const clear = () => {
  showDialog.value = false;
  formData.value = {
    username: '',
    contribution_amount: '',
    contributor_contract_number: '',
    contributor_contract_created_at: '',
    blagorost_agreement_number: '',
    blagorost_agreement_created_at: '',
    memo: '',
  };
};

const handleImportContributor = async () => {
  isSubmitting.value = true;
  try {
    const data = {
      coopname: info.coopname,
      username: formData.value.username,
      contribution_amount: parseFloat(formData.value.contribution_amount).toFixed(info.symbols.root_govern_precision) +  ' ' + info.symbols.root_govern_symbol,
      contributor_contract_number: formData.value.contributor_contract_number,
      contributor_contract_created_at: formData.value.contributor_contract_created_at,
      blagorost_agreement_number: formData.value.blagorost_agreement_number,
      blagorost_agreement_created_at: formData.value.blagorost_agreement_created_at,
      memo: formData.value.memo || undefined,
    };

    await importContributor(data);
    SuccessAlert(t('capital.importContributorButton.success'));
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
