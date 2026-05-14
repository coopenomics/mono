<template lang="pug">
span(v-if='!walletName').text-grey-6 —
span.wallet-id-cell(v-else)
  EntityIdBadge(
    :rawId='walletName'
    copy-on-click
  )
  q-tooltip(v-if='tooltipText' anchor='top middle' self='bottom middle') {{ tooltipText }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EntityIdBadge } from 'src/shared/ui'
import { getWalletHumanName } from 'src/shared/lib/ledger2'

const props = defineProps<{
  walletName: string | null | undefined
}>()

const tooltipText = computed(() => {
  if (!props.walletName) return ''
  const human = getWalletHumanName(props.walletName)
  return human ? `${human} (клик — копировать)` : 'Клик — копировать'
})
</script>
