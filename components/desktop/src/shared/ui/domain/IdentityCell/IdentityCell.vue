<template lang="pug">
.identity-cell
  span.identity-cell__name(v-if='fullName') {{ fullName }}
  AccountBadge(:account-name='accountName', size='sm', :copyable='copyable')
</template>

<script setup lang="ts">
import { AccountBadge } from 'src/shared/ui/domain/AccountBadge';
import type { IdentityCellProps } from './IdentityCell.types';

withDefaults(defineProps<IdentityCellProps>(), {
  copyable: true,
});
</script>

<style scoped>
.identity-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1, 4px);
  min-width: 0;
}

.identity-cell__name {
  color: var(--p-ink);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.3;
  overflow-wrap: break-word;
}
</style>
