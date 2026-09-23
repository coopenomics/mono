<template lang="pug">
div
  template(v-if="isSubmitting")
    Loader(:text="$t('union.addCooperativeForm.submittingText')")
  template(v-else)
    Form(:handler-submit="addNow" :showCancel="false" :button-cancel-txt="$t('union.addCooperativeForm.cancel')" :button-submit-txt="$t('union.addCooperativeForm.submitLabel')" @cancel="clear").q-gutter-md
      //- q-input(standout="bg-teal text-white" label="Имя аккаунта" v-model="data.coopname" :rules="[val => notEmpty(val)]")
      q-input(standout="bg-teal text-white" :hint="$t('union.addCooperativeForm.domainHint')" :label="$t('union.addCooperativeForm.domainLabel')" v-model="data.params.announce" :rules="[val => notEmpty(val), val => isDomain(val)]")

      q-input(standout="bg-teal text-white" hint="100 RUB" :label="$t('union.addCooperativeForm.initialIndividualLabel')" v-model="data.params.initial" type="number" :min="0" :rules="[val => notEmpty(val)]")
        template(#append)
          span.text-overline {{currency}}

      q-input(standout="bg-teal text-white" :hint="$t('union.addCooperativeForm.minimumIndividualHint')" v-model="data.params.minimum" type="number" :min="0" :rules="[val => notEmpty(val)]")
        template(#append)
          span.text-overline {{currency}}

      q-input(standout="bg-teal text-white" hint="1000 RUB" :label="$t('union.addCooperativeForm.initialOrgLabel')" v-model="data.params.org_initial" type="number" :min="0" :rules="[val => notEmpty(val)]")
        template(#append)
          span.text-overline {{currency}}

      q-input(standout="bg-teal text-white" hint="3000 RUB" :label="$t('union.addCooperativeForm.minimumOrgLabel')" v-model="data.params.org_minimum" type="number" :min="0"  :rules="[val => notEmpty(val)]")
        template(#append)
          span.text-overline {{currency}}

</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useAddCooperative } from '../model';
import { Form } from 'src/shared/ui/Form';
import { Loader } from 'src/shared/ui';
import { notEmpty, isDomain } from 'src/shared/lib/utils';
import { useSessionStore } from 'src/entities/Session';
import { RegistratorContract } from 'cooptypes';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { IDocument } from 'src/shared/lib/types/document';
import { env } from 'src/shared/config';
import { t } from 'src/shared/i18n';

const emit = defineEmits(['finish'])

const {addCooperative} = useAddCooperative()
const currency = computed(() => env.CURRENCY)
const isSubmitting = ref(false)

const props = defineProps({
  document: {
    type: Object as () => IDocument,
    required: true,
  },
  cooperative: {
    type: Object as () => any,
    default: null,
  }
})

const document = computed(() => props.document)

const session = useSessionStore()

// Функция для извлечения числового значения из IAsset
const extractNumericValue = (asset: any): string => {
  if (!asset) return ''
  if (typeof asset === 'number') return asset.toString()
  if (typeof asset === 'string') {
    // Извлекаем число из строки типа "1000.0000 RUB" и убираем лишние нули
    const match = asset.match(/^(\d+(?:\.\d+)?)/)
    if (match) {
      return parseFloat(match[1]).toString()
    }
  }
  return ''
}

const data = ref<RegistratorContract.Actions.RegisterCooperative.IRegisterCooperative>({
  coopname: session.username,
  params: {
    is_cooperative: true,
    coop_type: 'conscoop',
    announce: props.cooperative?.announce || '',
    description: '',
    initial: extractNumericValue(props.cooperative?.initial),
    minimum: extractNumericValue(props.cooperative?.minimum),
    org_initial: extractNumericValue(props.cooperative?.org_initial),
    org_minimum: extractNumericValue(props.cooperative?.org_minimum)
  },
  username: session.username,
  document: {
    version: '1.0.0',
    hash: '',
    doc_hash: '',
    meta_hash: '',
    meta: '',
    signatures: []
  }
})

// Следим за изменениями cooperative и обновляем данные
watch(() => props.cooperative, (newCooperative) => {
  if (newCooperative) {
    data.value.params.announce = newCooperative.announce || ''
    data.value.params.initial = extractNumericValue(newCooperative.initial)
    data.value.params.minimum = extractNumericValue(newCooperative.minimum)
    data.value.params.org_initial = extractNumericValue(newCooperative.org_initial)
    data.value.params.org_minimum = extractNumericValue(newCooperative.org_minimum)
  }
}, { immediate: true })

const clear = () => {
  emit('finish')
}

const addNow = async () => {
  try {
    isSubmitting.value = true
    data.value.document = {...document.value, meta: JSON.stringify(document.value.meta)}
    await addCooperative(data.value)
    SuccessAlert(t('union.addCooperativeForm.submitSuccess'))

    // После успешной отправки переходим к следующему шагу
    clear()
  } catch(e: any){
    FailAlert(e)
  } finally {
    isSubmitting.value = false
  }
}

</script>
