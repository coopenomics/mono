<template lang="pug">
span(v-if='accountCode === null || accountCode === undefined').t-faint —
span.account-id-cell(v-else)
  EntityIdBadge(
    :rawId='accountCode'
    copy-on-click
  )
  q-tooltip(v-if='tooltipText' anchor='top middle' self='bottom middle') {{ tooltipText }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EntityIdBadge } from 'src/shared/ui'
import { getAccountName } from 'src/shared/lib/ledger2'

const props = defineProps<{
  /** Код счёта (51, 80, 86), не stored id×1000. */
  accountCode: number | null | undefined
}>()

const tooltipText = computed(() => {
  if (props.accountCode === null || props.accountCode === undefined) return ''
  const name = getAccountName(props.accountCode)
  return name ? `${name} (клик — копировать)` : 'Клик — копировать'
})
</script>
