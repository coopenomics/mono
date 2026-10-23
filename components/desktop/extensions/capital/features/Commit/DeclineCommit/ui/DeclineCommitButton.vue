<template lang="pug">
div
  BaseButton(
    variant='danger',
    :size='mini || isMobile ? "sm" : "md"',
    :loading='loading',
    @click.stop='showDialog = true'
  ) {{ $t('capital.declineCommitButton.title') }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("capital.declineCommitButton.buttonTitle")',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-md(
      :handler-submit='handleDeclineCommit',
      :is-submitting='isSubmitting',
      :button-submit-txt='$t("capital.declineCommitButton.title")',
      :button-cancel-txt='$t("common.action.cancel")',
      @cancel='clear'
    )
      q-input(
        v-model='reason',
        outline
        :label='$t("capital.declineCommitButton.reasonLabel")',
        :rules='[(val) => !!val || $t("capital.declineCommitButton.reasonRequired")]',
        autocomplete='off'
        :placeholder='$t("capital.declineCommitButton.reasonPlaceholder")'
        type='textarea'
        rows='3'
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useDeclineCommit } from '../model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base';
import { Form } from 'src/shared/ui/Form';
import { useWindowSize } from 'src/shared/hooks';
import { t } from '../../../../i18n';

const { isMobile } = useWindowSize();
const props = defineProps<{
  mini?: boolean;
  commitHash: string;
}>();

const system = useSystemStore();
const { declineCommit } = useDeclineCommit();

const loading = ref(false);
const showDialog = ref(false);
const isSubmitting = ref(false);
const reason = ref('');

const clear = () => {
  showDialog.value = false;
  reason.value = '';
};

const handleDeclineCommit = async () => {
  try {
    isSubmitting.value = true;

    const declineData = {
      commit_hash: props.commitHash,
      coopname: system.info.coopname,
      reason: reason.value,
    };

    await declineCommit(declineData);
    SuccessAlert(t('capital.declineCommitButton.success'));
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
