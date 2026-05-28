<template lang="pug">
.signature-card(:class='`signature-card--${signature.status}`')
  .signature-card__head
    Avatar(
      :name='signature.signer.fullName',
      :src='signature.signer.avatar',
      size='sm'
    )
    .signature-card__signer
      span.signature-card__name {{ signature.signer.fullName }}
      AccountBadge(
        v-if='signature.signer.accountName',
        :account-name='signature.signer.accountName',
        size='sm'
      )
    .signature-card__status-row
      BaseChip(:variant='statusVariant') {{ statusLabel }}
      span.signature-card__date(v-if='signature.signedAt') {{ signature.signedAt }}

  .signature-card__hash(v-if='signature.status === "signed" && signature.hash')
    span.signature-card__hash-label Хэш подписи
    span.signature-card__hash-value {{ signature.hash }}

  BaseBanner(
    v-if='signature.status === "rejected" && signature.rejectionReason',
    variant='neg'
  )
    strong Подпись отклонена.
    |  {{ signature.rejectionReason }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Avatar } from 'src/shared/ui/base/Avatar';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import { AccountBadge } from 'src/shared/ui/domain/AccountBadge';
import type { SignatureCardProps, SignatureStatus } from './SignatureCard.types';

const props = defineProps<SignatureCardProps>();

const STATUS_VARIANT: Record<SignatureStatus, 'pos' | 'neg' | 'warn'> = {
  signed: 'pos',
  rejected: 'neg',
  pending: 'warn',
};
const STATUS_LABEL: Record<SignatureStatus, string> = {
  signed: 'Подписано',
  rejected: 'Отклонено',
  pending: 'Ожидает подписи',
};

const statusVariant = computed(() => STATUS_VARIANT[props.signature.status]);
const statusLabel = computed(() => STATUS_LABEL[props.signature.status]);
</script>

<style scoped>
.signature-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
}

.signature-card__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--p-3, 12px);
}

.signature-card__signer {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  min-width: 0;
}

.signature-card__name {
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.signature-card__status-row {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.signature-card__date {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.signature-card__hash {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  padding: var(--p-2, 8px) var(--p-3, 12px);
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm, 8px);
}
.signature-card__hash-label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
}
.signature-card__hash-value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-1);
  word-break: break-all;
}
</style>
