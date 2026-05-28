<template lang="pug">
.identity-panel(:class='compact ? "identity-panel--compact" : "identity-panel--full"')
  Avatar.identity-panel__avatar(
    :name='identity.fullName',
    :src='identity.avatar',
    :size='compact ? "sm" : "lg"'
  )
  template(v-if='compact')
    h3.identity-panel__name {{ identity.fullName }}
    AccountBadge(
      v-if='identity.accountName',
      :account-name='identity.accountName',
      size='sm'
    )
    BaseBadge(
      v-if='identity.status',
      :variant='statusVariant'
    ) {{ statusLabel }}
  template(v-else)
    .identity-panel__body
      .identity-panel__head
        h3.identity-panel__name {{ identity.fullName }}
        BaseBadge(
          v-if='identity.status',
          :variant='statusVariant'
        ) {{ statusLabel }}
      .identity-panel__meta(v-if='hasFullMeta')
        span.identity-panel__role(v-if='identity.role') {{ identity.role }}
        AccountBadge(
          v-if='identity.accountName',
          :account-name='identity.accountName',
          size='sm'
        )
        a.identity-panel__email(
          v-if='identity.email',
          :href='`mailto:${identity.email}`'
        ) {{ identity.email }}
  .identity-panel__actions(v-if='$slots.actions')
    slot(name='actions')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Avatar } from 'src/shared/ui/base/Avatar';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { AccountBadge } from 'src/shared/ui/domain/AccountBadge';
import type { IdentityPanelProps, IdentityStatus } from './IdentityPanel.types';

const props = withDefaults(defineProps<IdentityPanelProps>(), {
  compact: false,
});

const STATUS_VARIANT: Record<IdentityStatus, 'pos' | 'neg' | 'warn'> = {
  active: 'pos',
  blocked: 'neg',
  pending: 'warn',
};
const STATUS_LABEL: Record<IdentityStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
  pending: 'Ожидает',
};

const statusVariant = computed(() => props.identity.status ? STATUS_VARIANT[props.identity.status] : 'pos');
const statusLabel = computed(() => props.identity.status ? STATUS_LABEL[props.identity.status] : '');

const hasFullMeta = computed((): boolean => {
  const i = props.identity;
  return Boolean(i.role || i.accountName || i.email);
});
</script>

<style scoped>
.identity-panel {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink);
}

.identity-panel--compact {
  flex-wrap: wrap;
  gap: var(--p-2, 8px);
  padding: var(--p-2, 8px) var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.identity-panel--full {
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.identity-panel__avatar {
  flex-shrink: 0;
}

.identity-panel__body {
  flex: 1 1 auto;
  min-width: 0;
}

.identity-panel__head {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}

.identity-panel__name {
  margin: 0;
  font-size: var(--p-fs-h3, 15px);
  line-height: var(--p-lh-h3, 1.4);
  font-weight: 600;
  color: var(--p-ink);
  letter-spacing: var(--p-ls-h3, -0.005em);
  overflow-wrap: anywhere;
}
.identity-panel--compact .identity-panel__name {
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  margin-right: var(--p-1, 4px);
}

.identity-panel__meta {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
  margin-top: var(--p-1, 4px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.identity-panel__role {
  color: var(--p-ink-2);
}

.identity-panel__email {
  color: var(--p-primary);
  text-decoration: none;
}
.identity-panel__email:hover {
  text-decoration: underline;
}

.identity-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  margin-left: auto;
}
</style>
