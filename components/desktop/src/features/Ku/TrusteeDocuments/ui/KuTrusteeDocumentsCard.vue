<template lang="pug">
//- Один корневой узел: Vue применяет класс отступа со страницы к карточке.
div
  //- Зоны строки: опознание (документ, номер и срок) → состояние (бейдж) → действие.
  BaseCard(:title='$t("ku.trusteeDocuments.title")')
    .t-sm.t-muted.q-px-md.q-pt-sm(v-if='documents && !documents.has_protocol')
      | {{ $t('ku.trusteeDocuments.noProtocol') }}
    .trustee-docs(v-if='documents')
      //- Доверенность председателя участка
      .trustee-docs__row(
        :class='{ "trustee-docs__row--clickable": !!authority?.document }',
        @click='openSigned(authority?.document, $t("ku.trusteeDocuments.authorityTitle"))'
      )
        q-icon.trustee-docs__icon(name='badge', size='22px')
        .trustee-docs__identity
          .trustee-docs__title {{ $t('ku.trusteeDocuments.authorityTitle') }}
          .trustee-docs__meta(v-if='authority')
            | {{ $t('ku.trusteeDocuments.authorityMeta', { number: authority.number, until: ruDate(authority.valid_until) }) }}
          .trustee-docs__meta(v-else) {{ $t('ku.trusteeDocuments.authorityMissing') }}
          .trustee-docs__note(v-if='activeAuthority')
            q-icon(name='history', size='14px')
            span {{ $t('ku.trusteeDocuments.activeMeanwhile', { number: activeAuthority.number, until: ruDate(activeAuthority.valid_until) }) }}
          .trustee-docs__note(v-else-if='authority?.renewal_due && authorityStatus === "active"')
            q-icon(name='schedule', size='14px')
            span {{ $t('ku.trusteeDocuments.renewalDue') }}
        BaseBadge(:variant='authorityBadge.variant') {{ authorityBadge.label }}
        .trustee-docs__action
          BaseButton(
            v-if='documents.can_sign_authority',
            variant='primary',
            size='sm',
            :loading='flow.isSubmitting.value && preparing === "authority"',
            @click.stop='prepare("authority")'
          ) {{ authority ? $t('ku.trusteeDocuments.signNewAuthority') : $t('ku.trusteeDocuments.signAuthority') }}

      //- Договор о полной материальной ответственности
      .trustee-docs__row(
        :class='{ "trustee-docs__row--clickable": !!documents.liability }',
        @click='openSigned(documents.liability, $t("ku.trusteeDocuments.liabilityTitle"))'
      )
        q-icon.trustee-docs__icon(name='gavel', size='22px')
        .trustee-docs__identity
          .trustee-docs__title {{ $t('ku.trusteeDocuments.liabilityTitle') }}
          .trustee-docs__meta {{ $t('ku.trusteeDocuments.liabilityMeta') }}
        BaseBadge(:variant='liabilityBadge.variant') {{ liabilityBadge.label }}
        .trustee-docs__action
          BaseButton(
            v-if='canSignLiability',
            variant='primary',
            size='sm',
            :loading='flow.isSubmitting.value && preparing === "liability"',
            @click.stop='prepare("liability")'
          ) {{ $t('ku.trusteeDocuments.signLiability') }}
    TableSkeleton(v-else, :columns='skeletonColumns', :rows='2')

  //- Предпросмотр документа с подставленными данными перед подписью
  BaseDialog(v-model='previewOpen', :title='previewTitle', size='lg')
    .t-sm.t-muted.q-mb-md {{ $t('ku.trusteeDocuments.previewNotice') }}
    BaseDocument(v-if='previewAggregate', :document-aggregate='previewAggregate')
    template(#footer)
      BaseButton(variant='ghost', @click='previewOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='flow.isSubmitting.value', @click='sign') {{ $t('ku.trusteeDocuments.sign') }}

  //- Подписанный документ: доверенность или договор — открываются одинаково
  BaseDialog(v-model='signedOpen', :title='signedTitle', size='lg')
    BaseDocument(v-if='signedAggregate', :document-aggregate='signedAggregate')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, TableSkeleton } from 'src/shared/ui/base';
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { previewAggregate as toPreviewAggregate } from 'src/entities/Document/model';
import type { IGeneratedDocument } from 'src/shared/lib/document';
import { t } from 'src/shared/i18n';
import { useKuTrusteeDocuments } from '../model';

const props = defineProps<{ braname: string; branchName: string }>();

const flow = useKuTrusteeDocuments();
const documents = flow.documents;

const skeletonColumns: TableSkeletonColumn[] = [{ label: '' }, { label: '' }, { label: '' }];

const authority = computed(() => documents.value?.authority ?? null);

// GraphQL отдаёт значения перечислений именами (ACTIVE, NONE) — сравниваем в нижнем регистре.
const authorityStatus = computed(() => String(authority.value?.status ?? '').toLowerCase());
const liabilityStatus = computed(() => String(documents.value?.liability_status ?? 'none').toLowerCase());
const activeAuthority = computed(() => documents.value?.active_authority ?? null);

/** ГГГГ-ММ-ДД → ДД.ММ.ГГГГ — общий формат дат стола. */
function ruDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

const AUTHORITY_BADGES: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  active: { label: t('ku.trusteeDocuments.status.active'), variant: 'pos' },
  pending: { label: t('ku.trusteeDocuments.status.pending'), variant: 'warn' },
  expired: { label: t('ku.trusteeDocuments.status.expired'), variant: 'neg' },
  declined: { label: t('ku.trusteeDocuments.status.declined'), variant: 'neg' },
};

const authorityBadge = computed(
  () => AUTHORITY_BADGES[authorityStatus.value] ?? { label: t('ku.trusteeDocuments.status.none'), variant: 'neutral' as BaseBadgeVariant },
);

const LIABILITY_BADGES: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  approved: { label: t('ku.trusteeDocuments.liabilityStatus.approved'), variant: 'pos' },
  pending: { label: t('ku.trusteeDocuments.status.pending'), variant: 'warn' },
  declined: { label: t('ku.trusteeDocuments.liabilityStatus.declined'), variant: 'neg' },
  none: { label: t('ku.trusteeDocuments.liabilityStatus.none'), variant: 'neutral' },
};

const liabilityBadge = computed(() => LIABILITY_BADGES[liabilityStatus.value] ?? LIABILITY_BADGES.none);
const canSignLiability = computed(() => ['none', 'declined'].includes(liabilityStatus.value));

// ── Подпись ────────────────────────────────────────────────────────────────
type Kind = 'authority' | 'liability';
const preparing = ref<Kind | null>(null);
const prepared = ref<IGeneratedDocument | null>(null);
const previewOpen = ref(false);

const previewTitle = computed(() =>
  preparing.value === 'liability' ? t('ku.trusteeDocuments.liabilityTitle') : t('ku.trusteeDocuments.authorityTitle'),
);

// неподписанный документ: подписей ещё нет — минимальный агрегат для BaseDocument
const previewAggregate = computed(() =>
  prepared.value
    ? toPreviewAggregate(prepared.value)
    : null,
);

async function prepare(kind: Kind) {
  preparing.value = kind;
  try {
    prepared.value =
      kind === 'authority' ? await flow.prepareAuthority(props.braname) : await flow.prepareLiability(props.branchName);
    previewOpen.value = true;
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function sign() {
  if (!prepared.value || !preparing.value) return;
  try {
    if (preparing.value === 'authority') await flow.signAuthority(props.braname, prepared.value);
    else await flow.signLiability(props.braname, prepared.value);
    previewOpen.value = false;
    SuccessAlert(t('ku.trusteeDocuments.signed'));
    await flow.load(props.braname);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

// ── Просмотр подписанного документа: доверенность и договор — одинаково ──
const signedOpen = ref(false);
const signedAggregate = ref<IDocumentAggregate | null>(null);
const signedTitle = ref('');

function openSigned(document: unknown, title: string) {
  if (!document) return;
  signedAggregate.value = document as IDocumentAggregate;
  signedTitle.value = title;
  signedOpen.value = true;
}

async function reload() {
  try {
    await flow.load(props.braname);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

defineExpose({ reload });

// realtime: нет источника в карточке — карточку перечитывает страница участка по ленте изменений (KuMyBranchPage зовёт reload)
onMounted(reload);
watch(() => props.braname, reload);
</script>

<style lang="scss" scoped>
.trustee-docs {
  display: flex;
  flex-direction: column;
}
/* Строка: значок → опознание (тянется) → состояние → действие. */
.trustee-docs__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-3) var(--p-4);
  border-top: 1px solid var(--p-line);
}
.trustee-docs__row:first-child {
  border-top: none;
}
.trustee-docs__row--clickable {
  cursor: pointer;
}
.trustee-docs__row--clickable:hover {
  background: var(--p-surface-2);
}
.trustee-docs__icon {
  color: var(--p-ink-3);
}
.trustee-docs__title {
  font-weight: 600;
}
.trustee-docs__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.trustee-docs__note {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.trustee-docs__action {
  min-width: 0;
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 599px) {
  /* Узкий экран: значок слева, опознание, бейдж и действие — друг под другом. */
  .trustee-docs__row {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: var(--p-2);
  }
  .trustee-docs__row > :not(.trustee-docs__icon):not(.trustee-docs__identity) {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
