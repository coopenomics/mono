<template>
  <q-badge :color="badgeColor" :class="badgeTextColor">
    <template v-if="contract">{{ contract }} → {{ actionName }}</template>
    <template v-else>{{ actionName }}</template>
  </q-badge>
</template>
<script setup lang="ts">
  import { computed } from 'vue'
import { t } from 'src/shared/i18n';

  const getActionContract = (row: any, actionName: string) => {
    const { contract, action } = row
    if (
      contract &&
      ((contract !== 'eosio.token' && contract !== 'eosio') || action === actionName)
    ) {
      return contract
    }
    return ''
  }

  const ACTION_TYPES = {
    OTHER: 'OTHER',
    BUYRAM: 'BUYRAM',
    STAKECPUNET: 'STAKECPUNET',
    SENDTOKEN: 'SENDTOKEN',
    RECEIVETOKEN: 'RECEIVETOKEN',
    RAMFEE: 'RAMFEE',
    NEWACCOUNT: 'NEWACCOUNT',
  }

  const ACTION_NAMES = {
    [ACTION_TYPES.OTHER]: null,
    [ACTION_TYPES.BUYRAM]: t('accountActions.actionCell.buyram'),
    [ACTION_TYPES.STAKECPUNET]: t('accountActions.actionCell.stakecpunet'),
    [ACTION_TYPES.SENDTOKEN]: t('accountActions.actionCell.sendtoken'),
    [ACTION_TYPES.RECEIVETOKEN]: t('accountActions.actionCell.receivetoken'),
    [ACTION_TYPES.RAMFEE]: t('accountActions.actionCell.ramfee'),
    [ACTION_TYPES.NEWACCOUNT]: t('accountActions.actionCell.newaccount'),
  }

  const ACTION_BADGE_COLORS = {
    [ACTION_TYPES.OTHER]: 'white',
    [ACTION_TYPES.BUYRAM]: 'red',
    [ACTION_TYPES.STAKECPUNET]: 'blue',
    [ACTION_TYPES.SENDTOKEN]: 'red',
    [ACTION_TYPES.RECEIVETOKEN]: 'primary',
    [ACTION_TYPES.RAMFEE]: 'red',
    [ACTION_TYPES.NEWACCOUNT]: 'blue',
  }

  const getActionType = (row: any, currentAccount: string) => {
    const { data } = row
    if (row.action === 'transfer') {
      if (data.from === currentAccount || !currentAccount) {
        if (data.to === 'eosio.ramfee') {
          return ACTION_TYPES.RAMFEE
        }
        return ACTION_TYPES.SENDTOKEN
      } else if (data.to === currentAccount) {
        return ACTION_TYPES.RECEIVETOKEN
      }
    } else if (row.action === 'delegatebw') {
      return ACTION_TYPES.STAKECPUNET
    } else if (row.action === 'buyram' || row.action === 'buyrambytes') {
      return ACTION_TYPES.BUYRAM
    } else if (row.action === 'newaccount') {
      return ACTION_TYPES.NEWACCOUNT
    }

    return ACTION_TYPES.OTHER
  }

  const getActionNameByType = (action: string, actionType: string) => {
    return ACTION_NAMES[actionType] || action
  }

  const props = defineProps<{
    actionData: any
    account: string
  }>()

  const actionType = computed(() => getActionType(props.actionData, props.account))
  const actionName = computed(() => getActionNameByType(props.actionData.action, actionType.value))
  const contract = computed(() => getActionContract(props.actionData, actionName.value))
  const badgeColor = computed(
    () => ACTION_BADGE_COLORS[actionType.value] || ACTION_BADGE_COLORS.OTHER
  )
  const badgeTextColor = computed(() => {
    if (badgeColor.value === 'white') {
      return 'text-black'
    }
    return ''
  })
</script>

<style lang="scss" scoped></style>
