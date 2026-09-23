<template lang="pug">
q-page.document-templates
  .banner.banner--info.q-mb-md
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | {{ $t('cooperative.documentTemplatesPage.bannerLine1') }}
      | {{ $t('cooperative.documentTemplatesPage.bannerLine2') }}
      | {{ $t('cooperative.documentTemplatesPage.bannerLine3') }}

  template(v-if='firstLoad')
    BaseCard(variant='flat', :title='$t("cooperative.documentTemplatesPage.cardTitle")')
      BaseTable(:columns='columns', :rows='[]', row-key='registry_id', loading)

  template(v-else-if='!groups.length')
    EmptyState(:title='$t("cooperative.documentTemplatesPage.emptyTitle")', :body='$t("cooperative.documentTemplatesPage.emptyBody")')
      template(#icon)
        q-icon(name='description', size='40px')

  template(v-else)
    BaseCard.q-mb-md(v-for='group in groups', :key='group.owner', variant='flat', :title='group.title')
      BaseTable(:columns='columns', :rows='group.rows', row-key='registry_id')
        template(#cell-title='{ row }')
          .document-templates__title
            span.text-weight-medium {{ row.title }}
            span.t-sm.t-muted {{ KIND_LABEL[row.kind] ?? row.kind }}{{ row.bundle && row.kind === DocumentKind.Form ? $t('cooperative.documentTemplatesPage.bundleLabelPrefix') + bundleLabel(row.bundle) + '»' : '' }}
        template(#cell-approved='{ row }')
          .document-templates__edition(v-if='row.approved_version')
            span {{ $t('cooperative.documentTemplatesPage.approvedVersionLabel', { version: row.approved_version }) }}
            span.t-sm.t-muted {{ $t('cooperative.documentTemplatesPage.approvedProtocolLabel', { decisionId: row.approved_decision_id, approvedAt: formatApprovedAt(row.approved_at) }) }}
          span.t-sm.t-muted(v-else-if='row.state === DocumentApprovalState.NotRequired') {{ $t('cooperative.documentTemplatesPage.approvalNotRequiredLabel') }}
          span.t-sm.t-muted(v-else) {{ $t('cooperative.documentTemplatesPage.neverApprovedLabel') }}
        template(#cell-current_version='{ row }')
          span(v-if='row.current_version') {{ $t('cooperative.documentTemplatesPage.currentVersionLabel', { version: row.current_version }) }}
          span.t-sm.t-muted(v-else) {{ $t('cooperative.documentTemplatesPage.notOnChainLabel') }}
        template(#cell-state='{ row }')
          BaseBadge(:variant='stateView(row).variant') {{ stateView(row).label }}
        template(#cell-actions='{ row }')
          .document-templates__actions
            BaseButton(
              v-if='row.approved_version',
              variant='secondary',
              size='sm',
              :loading='opening === row.registry_id + ":approved"',
              @click='openBlank(row, DocumentTemplateEdition.Approved)'
            )
              template(#icon-left)
                q-icon.q-mr-xs(name='verified', size='16px')
              | {{ $t('cooperative.documentTemplatesPage.approvedTabLabel') }}
            BaseButton(
              v-if='showsCurrent(row)',
              variant='secondary',
              size='sm',
              :loading='opening === row.registry_id + ":current"',
              @click='openBlank(row, DocumentTemplateEdition.Current)'
            )
              template(#icon-left)
                q-icon.q-mr-xs(name='description', size='16px')
              | {{ currentLabel(row) }}
            BaseButton(
              v-if='row.state === DocumentApprovalState.Pending',
              variant='secondary',
              size='sm',
              @click='goToAgenda'
            )
              template(#icon-left)
                q-icon.q-mr-xs(name='how_to_vote', size='16px')
              | {{ $t('cooperative.documentTemplatesPage.toAgendaLabel') }}
            BaseButton(
              v-if='session.isChairman && needsCouncil(row)',
              variant='primary',
              size='sm',
              :loading='proposing === row.registry_id',
              @click='propose(row)'
            )
              template(#icon-left)
                q-icon.q-mr-xs(name='gavel', size='16px')
              | {{ proposeLabel(row) }}

  BaseDialog(v-model='viewer.open', :title='viewer.title', maximized)
    //- Бланк показывается тем же компонентом, что и подписанные документы в
    //- реестре: стили шаблона живут в shadow DOM, как в PDF. Хэшей и подписей
    //- у бланка нет — агрегат минимальный, блок подписей скрыт.
    BaseDocument(v-if='viewerAggregate', :document-aggregate='viewerAggregate')
    .t-sm.t-muted.q-mt-md(v-if='viewer.text_hash')
      | {{ $t('cooperative.documentTemplatesPage.textHashLabel') }}
      span.t-mono-sm {{ viewer.text_hash }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { uiLocale, t as i18nT } from 'src/shared/i18n';
import { useRouter } from 'vue-router';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api } from '../api';
import {
  DocumentApprovalState,
  DocumentKind,
  DocumentTemplateEdition,
  KIND_LABEL,
  STATE_VIEW,
  bundleToPropose,
  needsCouncil,
  ownerLabel,
  type IDocumentTemplate,
  type IDocumentTemplateEdition,
} from '../model';

const emit = defineEmits<{ changed: [] }>();

const { info } = useSystemStore();
const session = useSessionStore();
const router = useRouter();

const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const templates = ref<IDocumentTemplate[]>([]);
const proposing = ref<number | null>(null);
const opening = ref<string | null>(null);

const viewer = reactive({ open: false, title: '', html: '', text_hash: '' });
const viewerAggregate = computed(() =>
  viewer.html
    ? ({ rawDocument: { html: viewer.html, meta: { title: viewer.title } }, document: { doc_hash: '', signatures: [] } } as unknown as IDocumentAggregate)
    : null,
);

const columns: BaseTableColumn<IDocumentTemplate>[] = [
  { key: 'title', label: i18nT('cooperative.documentTemplatesPage.column.title') },
  { key: 'approved', label: i18nT('cooperative.documentTemplatesPage.column.approved'), width: '230px' },
  { key: 'current_version', label: i18nT('cooperative.documentTemplatesPage.column.currentVersion'), width: '170px', nowrap: true },
  { key: 'state', label: i18nT('cooperative.documentTemplatesPage.column.state'), width: '150px', nowrap: true },
  { key: 'actions', label: i18nT('cooperative.documentTemplatesPage.column.actions'), align: 'right', nowrap: true },
];

/** Текущую редакцию сети показываем, пока она не совпала с утверждённой, — и для документов без утверждения. */
const showsCurrent = (row: IDocumentTemplate): boolean =>
  Boolean(row.current_version) &&
  (row.state !== DocumentApprovalState.Approved || !row.approved_version);

const currentLabel = (row: IDocumentTemplate): string => {
  if (row.state === DocumentApprovalState.Outdated) return i18nT('cooperative.documentTemplatesPage.newEditionLabel', { version: row.current_version });
  if (row.state === DocumentApprovalState.Pending) return i18nT('cooperative.documentTemplatesPage.underReviewLabel');
  return i18nT('cooperative.documentTemplatesPage.openTextLabel');
};

/** Документы по владельцам: базовый набор кооператива первым, дальше приложения. */
const groups = computed(() => {
  const byOwner = new Map<string, IDocumentTemplate[]>();
  for (const t of templates.value) {
    const rows = byOwner.get(t.extension_name) ?? [];
    rows.push(t);
    byOwner.set(t.extension_name, rows);
  }
  return [...byOwner.entries()].map(([owner, rows]) => ({
    owner,
    title: ownerLabel(owner),
    rows: [...rows].sort((a, b) => a.order - b.order),
  }));
});

const stateView = (row: IDocumentTemplate) => STATE_VIEW[row.state] ?? { label: row.state, variant: 'neutral' as const };

/** Название пакета: первый документ пакета даёт ему имя. */
const bundleLabel = (bundle: string): string => {
  const first = templates.value.find((t) => t.bundle === bundle);
  return first ? first.title : bundle;
};

const proposeLabel = (row: IDocumentTemplate): string => {
  const pack = bundleToPropose(templates.value, row);
  return pack.length > 1 ? i18nT('cooperative.documentTemplatesPage.proposeBundleLabel', { count: pack.length }) : i18nT('cooperative.documentTemplatesPage.proposeLabel');
};

const formatApprovedAt = (value: string | null | undefined): string => {
  if (!value) return '______';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(uiLocale());
};

const load = async () => {
  if (!info.coopname) return;
  try {
    loading.value = true;
    templates.value = await api.loadDocumentTemplates(info.coopname);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};

const propose = async (row: IDocumentTemplate) => {
  const pack = bundleToPropose(templates.value, row);
  try {
    proposing.value = row.registry_id;
    await api.proposeDocumentApproval({ coopname: info.coopname, registry_ids: pack.map((t) => t.registry_id) });
    SuccessAlert(pack.length > 1 ? i18nT('cooperative.documentTemplatesPage.proposeBundleSuccess') : i18nT('cooperative.documentTemplatesPage.proposeSuccess'));
    await load();
    emit('changed');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    proposing.value = null;
  }
};

const openBlank = async (row: IDocumentTemplate, edition: IDocumentTemplateEdition) => {
  try {
    opening.value = `${row.registry_id}:${edition}`;
    const blank = await api.loadDocumentTemplateBlank({ coopname: info.coopname, registry_id: row.registry_id, edition });
    viewer.title = i18nT('cooperative.documentTemplatesPage.viewerTitle', { blankTitle: blank.title, version: edition === DocumentTemplateEdition.Approved ? row.approved_version : row.current_version });
    viewer.html = blank.html;
    viewer.text_hash = blank.text_hash;
    viewer.open = true;
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    opening.value = null;
  }
};

const goToAgenda = () => {
  router.push({ name: 'agenda', params: { coopname: info.coopname } });
};

onMounted(load);
</script>

<style lang="scss" scoped>
.document-templates__title {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.document-templates__edition {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.document-templates__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--p-2);
}
</style>
