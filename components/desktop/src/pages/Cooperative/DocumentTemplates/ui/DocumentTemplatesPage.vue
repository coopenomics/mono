<template lang="pug">
q-page.document-templates
  .banner.banner--info.q-mb-md
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Здесь все шаблоны документов, которыми пользуется кооператив: базовый набор и документы установленных приложений.
      | Пайщикам предъявляется только редакция, утверждённая советом. Когда оператор платформы выпускает новую редакцию,
      | её нужно вынести на совет — до решения кооператив продолжает работать по прежней.

  template(v-if='firstLoad')
    BaseCard(variant='flat', title='Кооператив')
      BaseTable(:columns='columns', :rows='[]', row-key='registry_id', loading)

  template(v-else-if='!groups.length')
    EmptyState(title='Шаблонов пока нет', body='Ни одно установленное приложение не объявило своих документов')
      template(#icon)
        q-icon(name='description', size='40px')

  template(v-else)
    BaseCard.q-mb-md(v-for='group in groups', :key='group.owner', variant='flat', :title='group.title')
      BaseTable(:columns='columns', :rows='group.rows', row-key='registry_id')
        template(#cell-title='{ row }')
          .document-templates__title
            span {{ row.title }}
            span.t-sm.t-muted {{ KIND_LABEL[row.kind] ?? row.kind }}{{ row.bundle && row.kind === DocumentKind.Form ? ' · пакет «' + bundleLabel(row.bundle) + '»' : '' }}
        template(#cell-approved='{ row }')
          template(v-if='row.approved_version')
            div № {{ row.approved_version }}
            .t-sm.t-muted протокол № {{ row.approved_decision_id }} от {{ formatApprovedAt(row.approved_at) }}
          span.t-muted(v-else) ______
        template(#cell-current_version='{ row }')
          span(v-if='row.current_version') № {{ row.current_version }}
          span.t-muted(v-else) ______
        template(#cell-state='{ row }')
          BaseBadge(:variant='stateView(row).variant') {{ stateView(row).label }}
        template(#cell-actions='{ row }')
          .document-templates__actions
            BaseButton(
              v-if='row.approved_version',
              variant='ghost',
              size='sm',
              :loading='opening === row.registry_id + ":approved"',
              @click='openBlank(row, DocumentTemplateEdition.Approved)'
            ) Утверждённая
            BaseButton(
              v-if='row.current_version && row.state !== DocumentApprovalState.Approved && row.state !== DocumentApprovalState.NotRequired',
              variant='ghost',
              size='sm',
              :loading='opening === row.registry_id + ":current"',
              @click='openBlank(row, DocumentTemplateEdition.Current)'
            ) Новая редакция
            BaseButton(
              v-if='row.current_version && (row.state === DocumentApprovalState.Approved || row.state === DocumentApprovalState.NotRequired) && !row.approved_version',
              variant='ghost',
              size='sm',
              :loading='opening === row.registry_id + ":current"',
              @click='openBlank(row, DocumentTemplateEdition.Current)'
            ) Открыть
            BaseButton(
              v-if='row.state === DocumentApprovalState.Pending',
              variant='ghost',
              size='sm',
              @click='goToAgenda'
            ) В повестке
            BaseButton(
              v-if='session.isChairman && needsCouncil(row)',
              variant='primary',
              size='sm',
              :loading='proposing === row.registry_id',
              @click='propose(row)'
            ) {{ proposeLabel(row) }}

  BaseDialog(v-model='viewer.open', :title='viewer.title', maximized)
    DocumentHtmlReader(v-if='viewer.html', :html='viewer.html')
    .t-sm.t-muted.q-mt-md(v-if='viewer.text_hash')
      | Хэш текста:&nbsp;
      span.t-mono-sm {{ viewer.text_hash }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable/BaseTable.types';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
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

const columns: BaseTableColumn<IDocumentTemplate>[] = [
  { key: 'title', label: 'Документ' },
  { key: 'approved', label: 'Утверждённая редакция', width: '220px' },
  { key: 'current_version', label: 'В сети', width: '90px', nowrap: true },
  { key: 'state', label: 'Состояние', width: '150px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '360px' },
];

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
  return pack.length > 1 ? `Вынести пакет (${pack.length})` : 'Вынести на совет';
};

const formatApprovedAt = (value: string | null | undefined): string => {
  if (!value) return '______';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU');
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
    SuccessAlert(pack.length > 1 ? 'Пакет документов вынесен на совет' : 'Документ вынесен на совет');
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
    viewer.title = `${blank.title} — редакция № ${edition === DocumentTemplateEdition.Approved ? row.approved_version : row.current_version}`;
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
.document-templates__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--p-2);
}
</style>
