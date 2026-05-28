<template lang="pug">
.person-card(:class='`person-card--${density}`')
  .person-card__head
    Avatar.person-card__avatar(
      :name='person.fullName',
      :src='person.avatar',
      :size='density === "compact" ? "sm" : "md"'
    )
    .person-card__head-body
      h3.person-card__name {{ person.fullName }}
      .person-card__head-meta(v-if='hasHeadMeta')
        span.person-card__role(v-if='person.role') {{ person.role }}
        AccountBadge(
          v-if='person.accountName',
          :account-name='person.accountName',
          size='sm'
        )
  .person-card__meta(v-if='density === "comfortable" && $slots.meta')
    slot(name='meta')
  ContactSheet.person-card__contacts(
    v-if='density === "comfortable" && person.contacts && person.contacts.length',
    :contacts='person.contacts',
    density='compact'
  )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Avatar } from 'src/shared/ui/base/Avatar';
import { AccountBadge } from 'src/shared/ui/domain/AccountBadge';
import { ContactSheet } from 'src/shared/ui/domain/ContactSheet';
import type { PersonCardProps } from './PersonCard.types';

const props = withDefaults(defineProps<PersonCardProps>(), {
  density: 'comfortable',
});

const hasHeadMeta = computed((): boolean => Boolean(props.person.role || props.person.accountName));
</script>

<style scoped>
.person-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  color: var(--p-ink);
}
.person-card--comfortable {
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.person-card__head {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--p-3, 12px);
}

.person-card__head-body {
  min-width: 0;
}

.person-card__name {
  margin: 0;
  font-size: var(--p-fs-h3, 15px);
  line-height: var(--p-lh-h3, 1.4);
  font-weight: 600;
  color: var(--p-ink);
  letter-spacing: var(--p-ls-h3, -0.005em);
  overflow-wrap: anywhere;
}
.person-card--compact .person-card__name {
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}

.person-card__head-meta {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
  margin-top: var(--p-1, 4px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.person-card__role {
  color: var(--p-ink-2);
}

.person-card__meta {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.person-card__contacts {
  margin-top: 0;
}
</style>
