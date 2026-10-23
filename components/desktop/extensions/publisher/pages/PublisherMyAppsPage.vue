<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('publisher.myApps.intro') }}

    TableSkeleton(v-if='loading && !packages.length', :columns='skeletonColumns', :rows='2')
    BaseBanner.q-mb-md(v-else-if='error', variant='neg') {{ error }}
    EmptyState(
      v-else-if='!packages.length',
      :title="$t('publisher.myApps.emptyTitle')",
      :body="$t('publisher.myApps.emptyBody')"
    )
      template(#icon)
        q-icon(name='key', size='28px')

    template(v-else)
      .q-mb-lg(v-for='p in packages', :key='p.packageId')
        .myapps__head.q-mb-sm
          h3.myapps__title.t-mono {{ p.packageId }}
          BaseButton(variant='primary', size='sm', @click='openIssue(p.packageId)') {{ $t('publisher.myApps.issue') }}
        .table-wrap
          .table-scroll
            table.table
              thead
                tr
                  th {{ $t('publisher.column.label') }}
                  th {{ $t('publisher.column.token') }}
                  th {{ $t('publisher.column.issued') }}
                  th {{ $t('publisher.column.used') }}
                  th {{ $t('publisher.column.status') }}
                  th.col-action {{ $t('publisher.column.actions') }}
              tbody
                tr(v-if='!tokensFor(p.packageId).length')
                  td.t-muted(colspan='6') {{ $t('publisher.myApps.noTokens') }}
                tr(v-for='token in tokensFor(p.packageId)', :key='token.id')
                  td {{ token.label }}
                  td
                    span.t-mono {{ token.tokenPrefix }}…
                  td {{ formatDate(token.createdAt) }}
                  td {{ formatDate(token.lastUsedAt) }}
                  td
                    BaseBadge(:variant='statusOf(token).variant') {{ statusOf(token).label }}
                  td.col-action
                    BaseButton(
                      variant='danger',
                      size='sm',
                      :disabled='!!token.revokedAt',
                      @click='openRevoke(token)'
                    ) {{ $t('publisher.myApps.revoke') }}

  BaseDialog(v-model='issueDialog', :title="$t('publisher.myApps.issue')", size='sm')
    template(v-if='!issuedToken')
      p.t-sm.t-muted.q-mb-sm
        | {{ $t('publisher.myApps.packageLabel') }}
        |
        span.t-mono {{ issuePackageId }}
      BaseInput(
        v-model='form.label',
        :label="$t('publisher.myApps.labelLabel')",
        placeholder='CI github/voskhod/demoapp',
        :hint="$t('publisher.myApps.labelHint')",
        :error='formErrors.label',
        required
      )
      BaseInput(
        v-model='form.expiresInDays',
        :label="$t('publisher.myApps.expiresLabel')",
        :placeholder="$t('publisher.myApps.expiresPlaceholder')",
        :hint="$t('publisher.myApps.expiresHint')",
        :error='formErrors.expiresInDays'
      )
      BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(v-else)
      BaseBanner.q-mb-sm(variant='warn') {{ $t('publisher.myApps.copyWarning') }}
      BaseInput(
        :model-value='issuedToken',
        :label="$t('publisher.myApps.tokenLabel')",
        readonly,
        :hint="$t('publisher.myApps.tokenHint')"
      )
      .t-fs-13.t-muted.q-mt-sm {{ $t('publisher.myApps.npmrcLabel') }}
      pre.myapps__snippet.t-mono.t-fs-13 {{ npmrcSnippet }}
      .myapps__copy
        BaseButton(variant='secondary', size='sm', @click='copyToken')
          | {{ copied ? $t('publisher.myApps.copied') : $t('publisher.myApps.copy') }}
    template(#footer)
      template(v-if='!issuedToken')
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='issueDialog = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', :loading='isSubmitting', @click='confirmIssue') {{ $t('publisher.myApps.issueSubmit') }}
      BaseButton(v-else, variant='primary', @click='issueDialog = false') {{ $t('publisher.myApps.done') }}

  BaseDialog(v-model='revokeDialog', :title="$t('publisher.myApps.revokeTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('publisher.myApps.revokeText', { label: selected?.label, prefix: selected?.tokenPrefix }) }}
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='revokeDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', :loading='isSubmitting', @click='confirmRevoke') {{ $t('publisher.myApps.revoke') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { useMyPublisherTokens, type IMyToken } from '../features/MyPublisherTokens/model';
import { t } from '../i18n';

const { packages, tokens, loading, error, isSubmitting, actionError, issuedToken, load, issue, revoke } =
  useMyPublisherTokens();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('publisher.column.label') },
  { label: t('publisher.column.token'), width: '140px' },
  { label: t('publisher.column.issued'), width: '120px' },
  { label: t('publisher.column.used'), width: '120px' },
  { label: t('publisher.column.status'), cell: 'badge' },
  { label: t('publisher.column.actions'), cell: 'icon', class: 'col-action' },
];

function tokensFor(packageId: string): IMyToken[] {
  return tokens.value.filter((t) => t.packageId === packageId);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function statusOf(token: IMyToken): { label: string; variant: BaseBadgeVariant } {
  if (token.revokedAt) return { label: t('publisher.myApps.status.revoked'), variant: 'neutral' };
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return { label: t('publisher.myApps.status.expired'), variant: 'warn' };
  return { label: t('publisher.myApps.status.active'), variant: 'pos' };
}

const issueDialog = ref(false);
const revokeDialog = ref(false);
const issuePackageId = ref('');
const selected = ref<IMyToken | null>(null);
const copied = ref(false);
const form = reactive({ label: '', expiresInDays: '' });
const formErrors = reactive({ label: '', expiresInDays: '' });

const npmrcSnippet = computed(() => {
  const scope = issuePackageId.value.split('/')[0] ?? '@coop';
  const host = window.location.host.replace(/^[^.]+\./, 'catalog.');
  return `${scope}:registry=https://${host}/registry/\n//${host}/registry/:_authToken=${issuedToken.value ?? ''}`;
});

function openIssue(packageId: string) {
  issuePackageId.value = packageId;
  form.label = '';
  form.expiresInDays = '';
  formErrors.label = '';
  formErrors.expiresInDays = '';
  actionError.value = null;
  issuedToken.value = null;
  copied.value = false;
  issueDialog.value = true;
}

async function confirmIssue() {
  formErrors.label = form.label.trim() ? '' : t('publisher.myApps.labelRequired');
  const days = form.expiresInDays.trim();
  formErrors.expiresInDays =
    days === '' || (/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650) ? '' : t('publisher.myApps.expiresRange');
  if (formErrors.label || formErrors.expiresInDays) return;
  await issue({
    packageId: issuePackageId.value,
    label: form.label.trim(),
    ...(days ? { expiresInDays: Number(days) } : {}),
  });
}

async function copyToken() {
  if (!issuedToken.value) return;
  try {
    await navigator.clipboard.writeText(issuedToken.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

function openRevoke(t: IMyToken) {
  selected.value = t;
  actionError.value = null;
  revokeDialog.value = true;
}

async function confirmRevoke() {
  if (!selected.value) return;
  const ok = await revoke(selected.value.id);
  if (ok) revokeDialog.value = false;
}

// realtime: нет источника — ключи издателя живут во внешнем каталоге, лента цепи кооператива о них не сообщает.
onMounted(load);
</script>

<style scoped>
.myapps__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.myapps__title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
.myapps__snippet {
  margin: 4px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.1);
  white-space: pre-wrap;
  word-break: break-all;
}
.myapps__copy {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>
