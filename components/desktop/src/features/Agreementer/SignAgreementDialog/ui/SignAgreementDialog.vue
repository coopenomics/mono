<template lang="pug">
BaseDialog(
  v-model='show',
  :title='title',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  div.row.justify-center
    q-card(flat).col-md-8.col-xs-12.q-pa-lg
      Loader(v-if="isLoading" :text='$t(`agreementer.signAgreementDialog.loadingText`)')
      slot
  template(#footer)
    .sign-agreement__actions
      BaseButton(
        v-if='!isLoading',
        variant='primary',
        :loading='isSubmitting',
        @click='sign'
      ) {{ $t('common.action.sign') }}
</template>

<script lang="ts" setup>
import { useAgreementStore } from 'src/entities/Agreement';
import { computed, ref } from 'vue';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { SovietContract } from 'cooptypes';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSignAgreement } from '../model';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
const { info } = useSystemStore()

import { useSessionStore } from 'src/entities/Session';
import { Loader } from 'src/shared/ui/Loader';

const session = useSessionStore()
const title = computed(() => props.is_modify ? t('agreementer.signAgreementDialog.titleModify') : t('agreementer.signAgreementDialog.title'))

const props = defineProps({
  agreement: {
    type: Object as () => SovietContract.Tables.CoopAgreements.ICoopAgreement,
    required: true,
  },
  is_modify: {
    type: Boolean,
    required: true
  }
})

const show = ref(true)
const isSubmitting = ref(false)
const isLoading = computed(() => agreementOnSign.value ? false : true)

const {signAgreement} = useSignAgreement()

const agreementStore = useAgreementStore()
const agreementOnSign = computed(() => agreementStore.generatedAgreements.find(el => el.meta.registry_id == props.agreement.draft_id))

const sign = async () => {

  if (!agreementOnSign.value){
    FailAlert(t('agreementer.signAgreementDialog.signMissingError'));
    return
  }

  try {
    isSubmitting.value = true
    await signAgreement(props.agreement.type, agreementOnSign.value)
    const walletStore = useWalletStore()
    // Подпись отвечает, когда узел разобрал её блок и записал её в базу, —
    // перечитанный кошелёк уже её содержит.
    await walletStore.loadUserWallet({coopname: info.coopname, username: session.username})
    isSubmitting.value = false
    show.value = false
    SuccessAlert(t('agreementer.signAgreementDialog.acceptedSuccess'))
  } catch(e: any){
    isSubmitting.value = false
    console.error(e)
    FailAlert(t('agreementer.signAgreementDialog.signError', { message: e.message }))
  }

}

</script>

<style scoped>
/* Кнопка живёт в слоте footer BaseDialog — он вне скроллящегося body,
   поэтому «Подписать» всегда прижата к низу и доступна без прокрутки
   длинного документа. */
.sign-agreement__actions {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
