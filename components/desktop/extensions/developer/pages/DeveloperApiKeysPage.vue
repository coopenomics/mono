<template lang="pug">
//- Реестр ключей: ключи сравнивают по пакетам и состоянию, поэтому таблица.
//- Зоны строки: опознание (название, начало ключа и дата) → пакеты ключа →
//- последнее использование → состояние. Строка открывает панель ключа,
//- отзыв — в подвале панели. Выпуск ключа — действие шапки страницы.
.q-pa-md
  PageHint.q-mb-md(storage-key='developer:api-keys:hint-dismissed')
    | {{ $t('developer.apiKeys.intro') }}

  BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

  EmptyState(
    v-else-if='!firstLoad && !keys.length',
    :title="$t('developer.apiKeys.emptyTitle')",
    :body="$t('developer.apiKeys.emptyBody')"
  )
    template(#icon)
      q-icon(name='key', size='32px')

  BaseTable(
    v-else,
    :columns='columns',
    :rows='keys',
    row-key='id',
    :loading='firstLoad',
    :skeleton-rows='3',
    min-width='720px',
    clickable-rows,
    @row-click='openKey'
  )
    template(#cell-key='{ row }')
      .api-keys__name {{ row.label }}
      .t-sm.t-muted
        span.t-mono {{ row.tokenPrefix }}…
        |
        | · {{ formatDate(row.createdAt) }}
    template(#cell-packages='{ row }')
      BaseBadge(v-if='row.allPackages', variant='info') {{ $t('developer.apiKeys.allPackages') }}
      .api-keys__packages(v-else)
        span.t-mono(v-for='id in row.packageIds', :key='id') {{ id }}
    template(#cell-used='{ row }')
      span(v-if='row.lastUsedAt') {{ formatDate(row.lastUsedAt) }}
      span.t-muted(v-else) {{ $t('developer.apiKeys.neverUsed') }}
    template(#cell-state='{ row }')
      BaseBadge(:variant='STATES[apiKeyState(row)].variant') {{ STATES[apiKeyState(row)].label }}
      .t-sm.t-muted(v-if='expiryNote(row)') {{ expiryNote(row) }}

  //- Панель ключа: состояние → факты → пакеты. Отзыв — в подвале.
  DetailsDrawer(v-model='drawerOpen', :title="current ? current.label : ''", :width='520')
    template(v-if='current')
      BaseBadge(:variant='STATES[apiKeyState(current)].variant') {{ STATES[apiKeyState(current)].label }}
      .api-keys__facts.q-mt-md
        DataRow(align='spread', :label="$t('developer.apiKeys.prefixLabel')", :value='`${current.tokenPrefix}…`', mono)
        DataRow(align='spread', :label="$t('developer.apiKeys.createdLabel')", :value='formatDate(current.createdAt)')
        DataRow(
          align='spread',
          :label="$t('developer.apiKeys.expiresLabel')",
          :value="current.expiresAt ? formatDate(current.expiresAt) : $t('developer.apiKeys.noExpiry')"
        )
        DataRow(
          align='spread',
          :label="$t('developer.apiKeys.usedLabel')",
          :value="current.lastUsedAt ? formatDate(current.lastUsedAt) : $t('developer.apiKeys.neverUsed')"
        )

      .api-keys__section
        .t-eyebrow.q-mb-sm {{ $t('developer.apiKeys.packagesTitle') }}
        p.t-sm.t-muted(v-if='current.allPackages') {{ $t('developer.apiKeys.allPackagesText') }}
        q-list(v-if='current.packageIds.length', separator)
          q-item.api-keys__package(v-for='id in current.packageIds', :key='id')
            q-item-section
              .t-mono {{ id }}
        .t-sm.t-muted(v-else-if='!current.allPackages') {{ $t('developer.apiKeys.noPackages') }}

    template(v-if="current && apiKeyState(current) === 'active'", #footer)
      .api-keys__footer
        q-space
        BaseButton(variant='danger', :loading='isSubmitting', @click='revokeCurrent') {{ $t('developer.keys.revoke') }}

  //- Выпуск ключа: название → пакеты (все либо отмеченные) → срок.
  //- После выпуска диалог показывает ключ один раз и как его передать команде.
  BaseDialog(v-model='issueDialog', :title="$t('developer.keys.issue')", size='md')
    template(v-if='!issuedKey')
      BaseInput(
        v-model='issueForm.label',
        :label="$t('developer.apiKeys.nameLabel')",
        :hint="$t('developer.apiKeys.nameHint')",
        :error='issueErrors.label',
        autofocus,
        required
      )
      .t-eyebrow.q-mt-md.q-mb-sm {{ $t('developer.apiKeys.scopeTitle') }}
      BaseSegmented(v-model='issueForm.scope', :options='scopeOptions', :aria-label="$t('developer.apiKeys.scopeTitle')")
      .api-keys__choice.q-mt-sm(v-if="issueForm.scope === 'selected'")
        BaseCheckbox(
          v-for='id in packageIds',
          :key='id',
          :model-value='issueForm.packageIds.includes(id)',
          :label='id',
          block,
          @update:model-value='togglePackage(id, $event)'
        )
        .t-sm.t-muted(v-if='!packageIds.length') {{ $t('developer.apiKeys.noOwnPackages') }}
        .t-sm.text-negative(v-if='issueErrors.packages') {{ issueErrors.packages }}
      p.t-sm.t-muted.q-mt-sm(v-else) {{ $t('developer.apiKeys.allPackagesText') }}
      .t-eyebrow.q-mt-md.q-mb-sm {{ $t('developer.apiKeys.expiresLabel') }}
      BaseSegmented(v-model='issueForm.expires', :options='expiryOptions', :aria-label="$t('developer.apiKeys.expiresLabel')")
      BaseBanner.q-mt-md(v-if='actionError', variant='neg') {{ actionError }}
    template(v-else)
      BaseBanner.q-mb-md(variant='warn') {{ $t('developer.keys.copyWarning') }}
      DataRow(:label="$t('developer.keys.keyLabel')", :value='issuedKey', align='vertical', mono, copyable)
      DataRow(
        :label="$t('developer.apiKeys.envLabel')",
        :value='`export CATALOG_PUBLISHER_TOKEN=${issuedKey}`',
        :hint="$t('developer.apiKeys.envHint')",
        align='vertical',
        mono,
        copyable
      )
    template(#footer)
      template(v-if='!issuedKey')
        BaseButton(variant='ghost', :disabled='isSubmitting', @click='issueDialog = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', :loading='isSubmitting', @click='confirmIssue') {{ $t('developer.keys.issueSubmit') }}
      BaseButton(v-else, variant='primary', @click='issueDialog = false') {{ $t('developer.keys.done') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  BaseSegmented,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { useHeaderActions } from 'src/shared/hooks';
import { apiKeyState, useApiKeys, type ApiKeyState, type IApiKey } from '../features/ApiKeys/model';
import { formatDate } from '../shared/lib/format';
import HeaderActionButton from '../shared/ui/HeaderActionButton.vue';
import { t } from '../i18n';

/**
 * «Ключи API»: ключи издателя для команды выпуска набора издателя (487-37).
 * Ключ принадлежит пайщику, а не пакету: он действует на отмеченные пакеты
 * либо на все пакеты издателя, включая будущие. Срок по умолчанию не задан.
 */

/** Срок ключа на выбор: без срока либо дни. */
const EXPIRY_DAYS = [30, 90, 365] as const;
const NO_EXPIRY = 'none';

const route = useRoute();
const { confirm } = useConfirm();
const { registerAction } = useHeaderActions();
const { keys, packageIds, loading, error, isSubmitting, actionError, issuedKey, load, issue, revoke } = useApiKeys();
const firstLoad = useFirstLoad(loading);

const STATES: Record<ApiKeyState, { label: string; variant: BaseBadgeVariant }> = {
  active: { label: t('developer.keys.state.active'), variant: 'pos' },
  expired: { label: t('developer.keys.state.expired'), variant: 'warn' },
  revoked: { label: t('developer.keys.state.revoked'), variant: 'neutral' },
};

const columns: BaseTableColumn<IApiKey>[] = [
  { key: 'key', label: t('developer.apiKeys.column.key') },
  { key: 'packages', label: t('developer.apiKeys.column.packages'), width: '280px' },
  { key: 'used', label: t('developer.apiKeys.column.used'), width: '180px', nowrap: true },
  { key: 'state', label: t('developer.apiKeys.column.state'), width: '160px', nowrap: true },
];

/** Под бейджем — только новое: дата окончания у действующего ключа со сроком. */
function expiryNote(key: IApiKey): string {
  if (apiKeyState(key) !== 'active' || !key.expiresAt) return '';
  return t('developer.apiKeys.until', { date: formatDate(key.expiresAt) });
}

// ── Панель ключа ───────────────────────────────────────────────────────────
const drawerOpen = ref(false);
/** Ключ в панели — по идентификатору: после действия панель показывает свежее. */
const currentId = ref<string | null>(null);
const current = computed(() => keys.value.find((k) => k.id === currentId.value) ?? null);

function openKey(key: IApiKey) {
  currentId.value = key.id;
  drawerOpen.value = true;
}

async function revokeCurrent() {
  if (!current.value) return;
  const agreed = await confirm({
    title: t('developer.keys.revokeTitle'),
    message: t('developer.keys.revokeText', { label: current.value.label }),
    confirmLabel: t('developer.keys.revoke'),
    danger: true,
  });
  if (agreed && (await revoke(current.value.id))) drawerOpen.value = false;
}

// ── Выпуск ключа ───────────────────────────────────────────────────────────
const scopeOptions = [
  { value: 'all', label: t('developer.apiKeys.scopeAll') },
  { value: 'selected', label: t('developer.apiKeys.scopeSelected') },
];
const expiryOptions = [
  { value: NO_EXPIRY, label: t('developer.apiKeys.noExpiry') },
  ...EXPIRY_DAYS.map((days) => ({ value: String(days), label: t('developer.apiKeys.days', { days }) })),
];

const issueDialog = ref(false);
const issueForm = reactive<{ label: string; scope: string | number; packageIds: string[]; expires: string | number }>({
  label: '',
  scope: 'all',
  packageIds: [],
  expires: NO_EXPIRY,
});
const issueErrors = reactive({ label: '', packages: '' });

/** Открыть выпуск; `packageId` — пакет, отмеченный заранее при переходе со страницы «Мои пакеты». */
function openIssue(packageId?: string) {
  issueForm.label = t('developer.keys.labelDefault');
  issueForm.scope = packageId ? 'selected' : 'all';
  issueForm.packageIds = packageId ? [packageId] : [];
  issueForm.expires = NO_EXPIRY;
  issueErrors.label = '';
  issueErrors.packages = '';
  actionError.value = null;
  issuedKey.value = null;
  issueDialog.value = true;
}

function togglePackage(id: string, checked: boolean | null) {
  issueForm.packageIds = checked
    ? [...new Set([...issueForm.packageIds, id])]
    : issueForm.packageIds.filter((p) => p !== id);
}

async function confirmIssue() {
  const label = issueForm.label.trim();
  const allPackages = issueForm.scope === 'all';
  issueErrors.label = label ? '' : t('developer.keys.labelRequired');
  issueErrors.packages = !allPackages && issueForm.packageIds.length === 0 ? t('developer.apiKeys.packagesRequired') : '';
  if (issueErrors.label || issueErrors.packages) return;
  const days = issueForm.expires === NO_EXPIRY ? 0 : Number(issueForm.expires);
  await issue({
    label,
    allPackages,
    packageIds: allPackages ? [] : issueForm.packageIds,
    ...(days > 0 ? { expiresInDays: days } : {}),
  });
}

// realtime: нет источника — ключи хранит внешний каталог приложений, лента цепи кооператива о них не сообщает; список перечитывается после каждого действия на странице.
onMounted(async () => {
  registerAction({
    id: 'developer:issue-api-key',
    component: HeaderActionButton,
    props: { label: t('developer.keys.issue'), icon: 'key', onClick: () => openIssue() },
  });
  await load();
  // Переход со страницы «Мои пакеты»: выпуск ключа на конкретный пакет.
  const fromPackage = typeof route.query.issue === 'string' ? route.query.issue : '';
  if (fromPackage) openIssue(packageIds.value.includes(fromPackage) ? fromPackage : undefined);
});
</script>

<style scoped>
.api-keys__name {
  font-weight: 600;
}
.api-keys__packages {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
}
.api-keys__facts :deep(.data-row:last-child) {
  border-bottom: 0;
}
.api-keys__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.api-keys__package {
  padding-left: 0;
  padding-right: 0;
}
.api-keys__choice {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.api-keys__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
