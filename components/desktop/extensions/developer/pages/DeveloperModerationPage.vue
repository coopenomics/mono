<template lang="pug">
//- Каркас страницы списка по образцу «Мои заказы»: подсказка → каркас
//- загрузки → пустое состояние → строки заявок.
//- Строка: опознание (пакет и версия, кто и когда подал, сводка прав ядра) →
//- деньги (цена издателя) → состояние (что мешает решению) → действия.
//- Нажатие открывает панель заявки: права ядра перечнем, пояснение издателя.
.q-pa-md
  PageHint.q-mb-md(storage-key='developer:moderation:hint-dismissed')
    | {{ $t('developer.moderation.intro') }}

  BaseBanner.q-mb-md(v-if='error', variant='neg') {{ error }}

  CardListSkeleton(v-else-if='firstLoad', :count='2')

  EmptyState(
    v-else-if='!items.length',
    :title="$t('developer.moderation.emptyTitle')",
    :body="$t('developer.moderation.emptyBody')"
  )
    template(#icon)
      q-icon(name='fact_check', size='32px')

  .moderation__list(v-else)
    PackageRow(
      v-for='row in items',
      :key='row.id',
      :title='releaseName(row)',
      :meta='submittedLine(row)',
      :note='rightsSummary(row)',
      note-icon='shield',
      :note-warn='needsAttention(row)',
      :sum="hasPrice(row) ? priceLabel(row) : ''",
      :sum-caption='trialLabel(row)',
      :badge-label='stateOf(row).label',
      :badge-variant='stateOf(row).variant',
      @open='openRequest(row)'
    )
      template(v-if='row.requiresOverride', #badges)
        BaseBadge(variant='neg') {{ $t('developer.moderation.vulnerability') }}
      template(v-if='isSubmitted(row)', #actions)
        BaseButton(variant='danger', size='sm', @click='openReject(row)') {{ $t('developer.moderation.reject') }}
        BaseButton(variant='primary', size='sm', :disabled='!hasPrice(row)', @click='openApprove(row)')
          | {{ $t('developer.moderation.approve') }}

  //- Панель заявки: состояние → цена крупно → права ядра перечнем (каждое
  //- право — что оно даёт приложению) → пояснение издателя → факты. Решение — в подвале.
  DetailsDrawer(v-model='drawerOpen', :title="current ? releaseName(current) : ''", :width='520')
    template(v-if='current')
      .moderation__head
        .moderation__badges
          BaseBadge(:variant='stateOf(current).variant') {{ stateOf(current).label }}
          BaseBadge(v-if='current.requiresOverride', variant='neg') {{ $t('developer.moderation.vulnerability') }}
        .t-sm.t-muted(v-if='!hasPrice(current) && isSubmitted(current)') {{ $t('developer.moderation.priceRequired') }}
        .moderation__price(v-if='hasPrice(current)')
          .moderation__price-sum {{ priceLabel(current) }}
          .moderation__price-caption {{ trialLabel(current) }}

      .moderation__section
        .t-eyebrow.q-mb-sm {{ rightsTitle(current) }}
        q-list(v-if='rightsOf(current).length', separator)
          q-item.moderation__right(v-for='right in rightsOf(current)', :key='right.key')
            q-item-section
              .text-weight-medium {{ right.title }}
              .t-meta.t-muted {{ right.text }}
            q-item-section(side)
              BaseBadge(v-if='right.unknown', variant='warn') {{ $t('developer.rights.unknown') }}
              span.t-mono-sm.t-muted(v-else) {{ right.code }}
        .t-sm.t-muted(v-else) {{ $t('developer.rights.none') }}
        BaseBanner.q-mt-sm(v-for='note in notesOf(current)', :key='note', variant='warn') {{ note }}

      .moderation__section(v-if='briefOf(current).text')
        .t-eyebrow.q-mb-sm {{ $t('developer.moderation.briefTitle') }}
        .moderation__brief {{ briefOf(current).text }}

      .moderation__section
        .moderation__publisher
          .t-sm.t-muted {{ $t('developer.column.publisher') }}
          IdentityCell(:account-name='current.submittedBy', :full-name='accountName(current.submittedBy)')
        DataRow(align='spread', :label="$t('developer.moderation.submittedLabel')", :value='formatDate(current.submittedAt)')

    template(v-if='current && isSubmitted(current)', #footer)
      .moderation__footer
        BaseButton(variant='danger', @click='openReject(current)') {{ $t('developer.moderation.reject') }}
        q-space
        BaseButton(variant='primary', :disabled='!hasPrice(current)', @click='openApprove(current)')
          | {{ $t('developer.moderation.approve') }}

  BaseDialog(v-model='approveDialog', :title="$t('developer.moderation.approveTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.moderation.releaseLabel') }}
      |
      span.t-mono {{ selected?.packageId }}@{{ selected?.version }}
      |
      | {{ $t('developer.moderation.approveForAll') }}
    BaseCheckbox(
      v-if='selected?.requiresOverride',
      v-model='approveOverride',
      :label="$t('developer.moderation.overrideLabel')"
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg')
      | {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='actionLoading', @click='approveDialog = false')
        | {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='actionLoading', @click='confirmApprove')
        | {{ $t('developer.moderation.approve') }}

  BaseDialog(v-model='rejectDialog', :title="$t('developer.moderation.rejectTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.moderation.rejectText') }}
      |
      span.t-mono {{ selected?.packageId }}
      | .
    BaseInput(
      v-model='rejectReason',
      :label="$t('developer.moderation.rejectReason')",
      :error='rejectReasonError',
      required
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg')
      | {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='actionLoading', @click='rejectDialog = false')
        | {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', :loading='actionLoading', @click='confirmReject')
        | {{ $t('developer.moderation.reject') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  CardListSkeleton,
  EmptyState,
} from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { useFirstLoad } from 'src/shared/lib/composables';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { api as extensionApi } from 'src/entities/Extension/api';
import { Zeus, type Queries } from '@coopenomics/sdk';
import { splitModerationBrief, type ModerationBrief } from '../shared/lib/coreRights';
import { accountName, resolveAccountNames } from '../shared/lib/accountNames';
import { formatDate, formatRub } from '../shared/lib/format';
import PackageRow from '../shared/ui/PackageRow.vue';
import { t } from '../i18n';

/**
 * «Модерация» стола администратора: заявки издателей на выпуск. Администратор
 * видит, какие права ядра просит версия, цену издателя и пояснение, и решает:
 * одобрить либо отклонить с причиной.
 */
type ModerationRow = Queries.Extensions.AppsCatalogPendingModerations.IOutput[
  typeof Queries.Extensions.AppsCatalogPendingModerations.name
][number];

const items = ref<ModerationRow[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const error = ref<string | null>(null);
const firstLoad = useFirstLoad(loading);

/** Заявка ждёт решения модератора: только такую одобряют и отклоняют. */
function isSubmitted(row: ModerationRow): boolean {
  return row.status === Zeus.ModerationStatusEnum.SUBMITTED;
}

const releaseName = (row: ModerationRow) => `${row.packageId}@${row.version}`;

/** Мета-строка: кто подал и когда. Издатель — ФИО, пока имя не найдено — имя аккаунта. */
const submittedLine = (row: ModerationRow) =>
  `${accountName(row.submittedBy) ?? row.submittedBy} · ${formatDate(row.submittedAt)}`;

function hasPrice(row: ModerationRow): boolean {
  return row.rubPerMonth != null;
}

function priceLabel(row: ModerationRow): string {
  const rub = row.rubPerMonth ?? 0;
  return rub === 0 ? t('developer.price.free') : t('developer.perMonth', { amount: formatRub(rub) });
}

function trialLabel(row: ModerationRow): string {
  return row.trialDays > 0 ? t('developer.price.trialDays', { days: row.trialDays }) : t('developer.price.noTrial');
}

const STATES: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  SUBMITTED: { label: t('developer.moderation.status.submitted'), variant: 'info' },
  APPROVED: { label: t('developer.moderation.status.approved'), variant: 'pos' },
  APPROVED_PENDING_CHAIN: { label: t('developer.moderation.status.approvedPendingChain'), variant: 'info' },
  REJECTED: { label: t('developer.moderation.status.rejected'), variant: 'neg' },
  WITHDRAWN: { label: t('developer.moderation.status.withdrawn'), variant: 'neutral' },
};
/** Заявка без цены издателя решения не ждёт: одобрить её нельзя. */
const WAITS_PRICE = { label: t('developer.moderation.status.waitsPrice'), variant: 'warn' as BaseBadgeVariant };

/** Состояние заявки одним бейджем: что с ней сейчас. */
function stateOf(row: ModerationRow): { label: string; variant: BaseBadgeVariant } {
  if (isSubmitted(row) && !hasPrice(row)) return WAITS_PRICE;
  return STATES[row.status] ?? { label: row.status, variant: 'neutral' };
}

// ── Права ядра ─────────────────────────────────────────────────────────────
/**
 * Права ядра и пояснение издателя по заявке. Перечень прав каталог берёт из
 * манифеста версии; разбор — один раз на заявку.
 */
const briefs = new Map<string, ModerationBrief>();
function briefOf(row: ModerationRow): ModerationBrief {
  const key = `${row.id}:${row.brief}`;
  const known = briefs.get(key);
  if (known) return known;
  const parsed = splitModerationBrief(row.brief);
  briefs.set(key, parsed);
  return parsed;
}
const notesOf = (row: ModerationRow) => briefOf(row).rights?.notes ?? [];

/** Порты ядра, открытые приложениям каталога: имя из манифеста → название и что порт даёт приложению. */
const PORTS: Record<string, { title: string; text: string }> = {
  document: { title: t('developer.rights.port.document'), text: t('developer.rights.portText.document') },
  cooperativeVars: { title: t('developer.rights.port.cooperativeVars'), text: t('developer.rights.portText.cooperativeVars') },
  accessToken: { title: t('developer.rights.port.accessToken'), text: t('developer.rights.portText.accessToken') },
  account: { title: t('developer.rights.port.account'), text: t('developer.rights.portText.account') },
  chain: { title: t('developer.rights.port.chain'), text: t('developer.rights.portText.chain') },
};

/** Право ядра строкой перечня: название, что оно даёт, имя из манифеста. */
interface RightLine {
  key: string;
  title: string;
  text: string;
  code: string;
  /** Порт вне перечня ядра: модератор видит, что порт ему незнаком. */
  unknown: boolean;
}

function rightsOf(row: ModerationRow): RightLine[] {
  const rights = briefOf(row).rights;
  if (!rights) return [];
  const ports = rights.ports.map((port) => ({
    key: `port:${port}`,
    title: PORTS[port]?.title ?? port,
    text: PORTS[port]?.text ?? t('developer.rights.unknownText'),
    code: port,
    unknown: !PORTS[port],
  }));
  const actions = rights.chainActions.map((action) => ({
    key: `action:${action}`,
    title: t('developer.rights.chainAction'),
    text: t('developer.rights.chainActionText'),
    code: action,
    unknown: false,
  }));
  return [...ports, ...actions];
}

/** Обновление просит права сверх одобренных либо порт вне перечня ядра. */
function needsAttention(row: ModerationRow): boolean {
  return !!briefOf(row).rights?.expansion || rightsOf(row).some((right) => right.unknown) || notesOf(row).length > 0;
}

/** Сводка прав для строки списка: сколько портов и действий цепи; перечень — в панели. */
function rightsSummary(row: ModerationRow): string {
  const rights = briefOf(row).rights;
  if (!rights) return t('developer.rights.none');
  const parts = [
    rights.ports.length ? t('developer.rights.portsCount', { n: rights.ports.length }, rights.ports.length) : '',
    rights.chainActions.length ? t('developer.rights.actionsCount', { n: rights.chainActions.length }, rights.chainActions.length) : '',
    ...rights.notes,
  ].filter(Boolean);
  const summary = parts.join(' · ');
  return rights.expansion ? t('developer.rights.expansionSummary', { summary }) : summary;
}

const rightsTitle = (row: ModerationRow) =>
  briefOf(row).rights?.expansion ? t('developer.rights.expansionTitle') : t('developer.column.rights');

// ── Панель заявки ──────────────────────────────────────────────────────────
const drawerOpen = ref(false);
/** Заявка в панели — по идентификатору: после решения панель показывает свежее. */
const currentId = ref<string | null>(null);
const current = computed(() => items.value.find((row) => row.id === currentId.value) ?? null);

function openRequest(row: ModerationRow) {
  currentId.value = row.id;
  drawerOpen.value = true;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    items.value = await extensionApi.loadPendingModerations();
    void resolveAccountNames(items.value.map((row) => row.submittedBy));
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const selected = ref<ModerationRow | null>(null);
const approveDialog = ref(false);
const rejectDialog = ref(false);
const approveOverride = ref(false);
const rejectReason = ref('');
const rejectReasonError = ref('');
const actionLoading = ref(false);
const actionError = ref<string | null>(null);

function openApprove(m: ModerationRow) {
  selected.value = m;
  approveOverride.value = false;
  actionError.value = null;
  approveDialog.value = true;
}

function openReject(m: ModerationRow) {
  selected.value = m;
  rejectReason.value = '';
  rejectReasonError.value = '';
  actionError.value = null;
  rejectDialog.value = true;
}

async function confirmApprove() {
  if (!selected.value) return;
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.approveModeration({
      moderationId: selected.value.id,
      scope: { type: Zeus.ReleaseScopeType.ALL },
      ...(approveOverride.value ? { override: true } : {}),
    });
    if (
      result.status === Zeus.ApproveModerationStatus.APPLIED ||
      result.status === Zeus.ApproveModerationStatus.PENDING_CHAIN
    ) {
      approveDialog.value = false;
      drawerOpen.value = false;
      await load();
    } else if (result.status === Zeus.ApproveModerationStatus.REQUIRES_OVERRIDE) {
      actionError.value = t('developer.moderation.overrideRequired');
    } else {
      actionError.value = result.error || t('developer.moderation.approveFailed');
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

async function confirmReject() {
  if (!selected.value) return;
  rejectReasonError.value = '';
  const reason = rejectReason.value.trim();
  if (reason.length < 3) {
    rejectReasonError.value = t('developer.moderation.reasonTooShort');
    return;
  }
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.rejectModeration({
      moderationId: selected.value.id,
      reason,
    });
    if (result.status === Zeus.RejectModerationStatus.APPLIED) {
      rejectDialog.value = false;
      drawerOpen.value = false;
      await load();
    } else {
      actionError.value = result.error || t('developer.moderation.rejectFailed');
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

// realtime: нет источника — заявки живут во внешнем каталоге, лента цепи кооператива о них не сообщает.
onMounted(load);
</script>

<style scoped>
.moderation__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.moderation__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
}
.moderation__badges {
  display: flex;
  gap: var(--p-1);
}
.moderation__price-sum {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  line-height: var(--p-lh-h1);
  font-variant-numeric: tabular-nums;
}
.moderation__price-caption {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.moderation__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.moderation__right {
  padding-left: 0;
  padding-right: 0;
}
.moderation__brief {
  color: var(--p-ink-2);
  overflow-wrap: anywhere;
}
.moderation__publisher {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}
.moderation__footer {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  width: 100%;
}
</style>
