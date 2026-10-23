<template lang="pug">
//- Решение по одобрению там, где процесс начался. Подписывает только
//- председатель; остальным видно, что документ ждёт его подписи.
.chairman-approval-actions
  template(v-if="session.isChairman")
    BaseButton(variant="ghost" size="sm" :disabled="busy" @click="ask('decline')") {{ $t('document.chairmanApprovalActions.decline') }}
    BaseButton(variant="primary" size="sm" :loading="busy && kind === 'approve'" @click="ask('approve')") {{ $t('common.action.sign') }}
  span.t-meta.t-muted(v-else) {{ $t('document.chairmanApprovalActions.awaitingChairman') }}

  BaseDialog(v-model="open" :title="kind === 'approve' ? $t('document.chairmanApprovalActions.signDialogTitle') : $t('document.chairmanApprovalActions.declineDialogTitle')" size="sm")
    p(v-if="kind === 'approve'") {{ $t('document.chairmanApprovalActions.signConfirmText', { documentTitle: title }) }}
    template(v-else)
      p {{ $t('document.chairmanApprovalActions.declineConfirmText', { documentTitle: title }) }}
      BaseInput.q-mt-sm(v-model="reason" :label="$t('document.chairmanApprovalActions.declineReasonLabel')" type="textarea" :rows="2" required)
    template(#footer)
      BaseButton(variant="ghost" :disabled="busy" @click="open = false") {{ $t('document.chairmanApprovalActions.cancel') }}
      BaseButton(
        :variant="kind === 'approve' ? 'primary' : 'secondary'"
        :disabled="kind === 'decline' && !reason.trim()"
        :loading="busy"
        @click="run"
      ) {{ kind === 'approve' ? $t('common.action.sign') : $t('document.chairmanApprovalActions.decline') }}
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session/model';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { useChairmanApprovalDecision } from '../model';
import { t } from 'src/shared/i18n';

const props = defineProps<{
  coopname: string;
  approvalHash: string;
  /** Что подписывается — для текста подтверждения. */
  title: string;
}>();
const emit = defineEmits<{ decided: [kind: 'approve' | 'decline'] }>();

const session = useSessionStore();
const { approve, decline } = useChairmanApprovalDecision();
const open = ref(false);
const busy = ref(false);
const kind = ref<'approve' | 'decline'>('approve');
const reason = ref('');

function ask(next: 'approve' | 'decline'): void {
  kind.value = next;
  reason.value = '';
  open.value = true;
}

async function run(): Promise<void> {
  busy.value = true;
  try {
    if (kind.value === 'approve') await approve(props.coopname, props.approvalHash);
    else await decline(props.coopname, props.approvalHash, reason.value.trim());
    SuccessAlert(kind.value === 'approve' ? t('document.chairmanApprovalActions.signedSuccess') : t('document.chairmanApprovalActions.declinedSuccess'));
    open.value = false;
    emit('decided', kind.value);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.chairman-approval-actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
</style>
