<template lang="pug">
div
  // div(v-if="props.action === 'transfer'")
  //   AccountLink(:account-name="actionData.from") →
  //   AccountLink(:account-name="actionData.to") {{ ' ' }} {{ actionData.quantity }}
  // div(v-else)
  div
    q-btn(color="primary" @click="dialog=true") {{ $t('accountActions.dataCell.detailsLabel') }}

  q-dialog(v-model="dialog" persistent :maximized="true" )
    q-card
      div()
        q-bar
          span {{ $t('accountActions.dataCell.dialogTitle') }}
          q-space
          q-btn(v-close-popup dense flat icon="close")
            q-tooltip Close
        div(v-if="isDocExist").q-pa-sm
          p HERE DOCUMENT READER

        q-btn(size="lg" color="primary" @click="dialog=false").full-width {{ $t('accountActions.dataCell.closeLabel') }}

        div.q-pa-sm
          ul
            li(v-for="row in dataParams" :key="row.key" style="word-wrap: break-word;").q-mt-md
              strong.q-mr-xs {{ row.key }}:
              AccountLink(v-if="row.isAccount" :account-name="row.value")
              span(v-else) {{ row.value }}

</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AccountLink from './AccountLink.vue'
import config from 'src/app/config'

const ACCOUNT_FIELDS: any = {
  from: 1,
  to: 1,
  owner: 1,
  payer: 1,
  receiver: 1,
  creator: 1,
  user_name: 1,
  account: 1,
  host: 1,
  root_contract: 1,
  notified: 1,
  contract: 1,
  username: 1,
}
const isAccount = (s: string) => /(^[a-z1-5.]{1,11}[a-z1-5]$)|(^[a-z1-5.]{12}[a-j1-5]$)/.test(s)

const dialog = ref(false)

const props = defineProps<{
  actionData: any
  action: string
  contract: string
}>()

const isDocExist = ref(false)
const docVars = ref({})

if (props.action == 'joincoop' && props.contract == config.tableCodeConfig.reg) {
  try {
    docVars.value = JSON.parse(props.actionData.signed_doc.vars)
    isDocExist.value = true
  } catch (e) {
    console.log(e)
  }
}

const dataParams = computed(() =>
  Object.keys(props.actionData).map((key: string) => ({
    key,
    value: props.actionData[key],
    isAccount: !!ACCOUNT_FIELDS[key] && isAccount(props.actionData[key]),
  }))
)
</script>

<style lang="scss" scoped></style>
src/app/config
