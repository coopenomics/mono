<template lang="pug">
.decision-result
  .decision-result__head
    .decision-result__label
      q-icon(name='description', size='18px')
      span.t-eyebrow Детальная информация
    h3.decision-result__title Результат интеллектуальной деятельности

  .decision-result__skel(v-if='loading')
    .skel(v-for='i in 3', :key='i')

  .banner.banner--neg(v-else-if='error')
    q-icon.banner__icon(name='error', size='20px')
    .banner__body {{ error }}

  template(v-else)
    .decision-result__panel
      .decision-result__summary
        DataRow(label='Компонент', :value='componentTitle')
        DataRow(v-if='projectTitle', label='Проект', :value='projectTitle')
        DataRow(label='Заявитель', :value='applicantName')
        DataRow(
          v-if='sharePercent',
          label='Доля в результате',
          :value='`${sharePercent}%`',
          mono
        )
        DataRow(
          v-if='contributionAmount',
          label='Паевой взнос',
          :value='contributionAmount',
          mono
        )
        DataRow(
          v-if='debtAmount',
          label='Погашаемая ссуда',
          :value='debtAmount',
          mono
        )
        DataRow(
          v-if='shortResultHash',
          label='Хеш результата',
          :value='shortResultHash',
          mono,
          copyable
        )

      .decision-result__tasks(v-if='issues.length')
        .decision-result__section-label.t-sm.t-muted Задачи в результате
        ul.decision-result__issues
          li(v-for='issue in issues', :key='issue.issue_hash')
            a.decision-result__issue-link(
              href='#',
              @click.prevent='goToIssue(issue.issue_hash)'
            ) {{ issue.title }}

    .decision-result__preview
      button.decision-result__toggle(
        type='button',
        @click='previewOpen = !previewOpen'
      )
        q-icon(:name='previewOpen ? "expand_less" : "expand_more"', size='20px')
        span {{ previewOpen ? 'Скрыть текст результата' : 'Показать текст результата' }}

      .decision-result__preview-body(v-if='previewOpen')
        template(v-if='parsedResult?.kind === "v2"')
          .result-markdown
            Editor(
              :model-value='parsedResult.markdown',
              readonly,
              :min-height='160',
              :padded='false',
              placeholder=''
            )
          .result-diff-blocks(v-if='parsedResult.diffHtmlBlocks.length')
            .result-diff-viewer(
              v-for='(block, idx) in parsedResult.diffHtmlBlocks',
              :key='idx',
              v-html='block'
            )
        template(v-else-if='parsedResult?.kind === "legacy_html"')
          .result-viewer(v-html='parsedResult.html')
        .banner.banner--info(v-else)
          q-icon.banner__icon(name='info', size='20px')
          .banner__body Текст результата ещё не сформирован.
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { IAgenda } from 'src/entities/Agenda/model';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { Editor } from 'src/shared/ui/Editor';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useSystemStore } from 'src/entities/System/model';
import { useResultStore } from 'app/extensions/capital/entities/Result/model';
import type { IResult } from 'app/extensions/capital/entities/Result/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useCommitStore } from 'app/extensions/capital/entities/Commit/model';
import {
  parseCapitalResultData,
  type ParsedResultData,
} from 'app/extensions/capital/shared/lib/resultDocumentPayload';
import { Zeus } from '@coopenomics/sdk';

interface Props {
  agenda: IAgenda;
}

interface StatementMeta {
  result_hash?: string;
  project_name?: string;
  component_name?: string;
  percent_of_result?: string;
  total_amount?: string;
  title?: string;
}

interface IssueLink {
  issue_hash: string;
  title: string;
}

const props = defineProps<Props>();
const router = useRouter();

const { info } = useSystemStore();
const resultStore = useResultStore();
const projectStore = useProjectStore();
const commitStore = useCommitStore();

const loading = ref(true);
const error = ref<string | null>(null);
const previewOpen = ref(false);
const result = ref<IResult | null>(null);
const componentTitle = ref('—');
const projectTitle = ref('');
const sharePercent = ref('');
const contributionAmount = ref('');
const debtAmount = ref('');
const projectHash = ref('');
const issues = ref<IssueLink[]>([]);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const applicantName = computed(() => {
  const certificate = props.agenda.table?.username_certificate;
  if (certificate) {
    return getShortNameFromCertificate(certificate);
  }
  return props.agenda.table?.username || '—';
});

const shortResultHash = computed(() => {
  const hash = result.value?.result_hash || statementMeta.value?.result_hash;
  if (!hash) return '';
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
});

const parsedResult = computed<ParsedResultData | null>(() => {
  const d = result.value?.data;
  if (typeof d !== 'string' || !d.trim()) return null;
  return parseCapitalResultData(d);
});

function parseMeta(raw: unknown): StatementMeta | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as StatementMeta;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as StatementMeta;
    } catch {
      return null;
    }
  }
  return null;
}

const statementMeta = computed<StatementMeta | null>(() => {
  const fromDoc =
    parseMeta(
      (props.agenda.documents as any)?.statement?.documentAggregate?.rawDocument
        ?.meta,
    ) ||
    parseMeta(
      (props.agenda.documents as any)?.statement?.documentAggregate?.document
        ?.meta,
    );
  const fromTable = parseMeta(props.agenda.table?.statement?.meta);
  return { ...(fromTable || {}), ...(fromDoc || {}) };
});

function formatMoney(raw?: string | number | null): string {
  if (raw === null || raw === undefined || raw === '') return '';
  const src =
    typeof raw === 'string' && /\s[A-Z]{3,7}$/.test(raw.trim())
      ? raw
      : `${raw} ${governSymbol.value}`;
  return formatAsset2Digits(src);
}

function collectIssues(commits: any[]): IssueLink[] {
  const map = new Map<string, IssueLink>();
  for (const commit of commits) {
    const items = Array.isArray(commit?.data) ? commit.data : [];
    for (const item of items) {
      if (item?.type !== 'committed_issues') continue;
      const list = item.data?.issues;
      if (!Array.isArray(list)) continue;
      for (const issue of list) {
        const issueHash = String(issue?.issue_hash || '').trim();
        if (!issueHash || map.has(issueHash)) continue;
        map.set(issueHash, {
          issue_hash: issueHash,
          title: String(issue?.title || issueHash).trim(),
        });
      }
    }
  }
  return Array.from(map.values());
}

const goToIssue = (issueHash: string) => {
  if (!projectHash.value || !issueHash) return;
  router.push({
    name: 'component-issue',
    params: {
      project_hash: projectHash.value,
      issue_hash: issueHash,
    },
    query: { _useHistoryBack: 'true' },
  });
};

async function loadDetails() {
  loading.value = true;
  error.value = null;
  issues.value = [];
  projectHash.value = '';
  result.value = null;

  try {
    const meta = statementMeta.value;
    const resultHash = meta?.result_hash;
    const username = props.agenda.table?.username;

    if (meta?.component_name) {
      componentTitle.value = meta.component_name;
    }
    if (meta?.project_name) {
      projectTitle.value = meta.project_name;
    }
    if (meta?.percent_of_result) {
      const n = parseFloat(meta.percent_of_result);
      sharePercent.value = Number.isFinite(n) ? n.toFixed(2) : String(meta.percent_of_result);
    }
    if (meta?.total_amount) {
      contributionAmount.value = formatMoney(meta.total_amount);
    }

    if (!username) {
      throw new Error('В решении не указан заявитель');
    }

    await resultStore.loadResults({
      filter: { username },
      options: { page: 1, limit: 50, sortOrder: 'DESC' },
    });

    const items = resultStore.results?.items || [];
    const matched = resultHash
      ? items.find((r) => r.result_hash === resultHash)
      : items[0];

    if (!matched) {
      throw new Error('Результат по заявлению не найден');
    }

    result.value = matched;

    if (matched.total_amount != null) {
      contributionAmount.value = formatMoney(matched.total_amount);
    }
    if (matched.debt_amount != null && Number(matched.debt_amount) > 0) {
      debtAmount.value = formatMoney(matched.debt_amount);
    }

    const matchedProjectHash = matched.project_hash;
    if (matchedProjectHash) {
      projectHash.value = matchedProjectHash;
      try {
        const project = await projectStore.loadProject({ hash: matchedProjectHash });
        if (project?.title) {
          componentTitle.value = project.title;
        }
        if (project?.parent_title) {
          projectTitle.value = project.parent_title;
        } else if (project?.parent_hash) {
          const parent = await projectStore.loadProject({
            hash: project.parent_hash,
          });
          if (parent?.title) {
            projectTitle.value = parent.title;
          }
        }
      } catch (e) {
        console.warn('Не удалось загрузить проект для решения createresult', e);
      }

      try {
        await commitStore.loadCommits({
          filter: {
            username,
            project_hash: matchedProjectHash,
            status: Zeus.CommitStatus.APPROVED,
          },
          options: { page: 1, limit: 200, sortOrder: 'ASC' },
        });
        issues.value = collectIssues(commitStore.commits?.items || []);
      } catch (e) {
        console.warn('Не удалось загрузить коммиты для решения createresult', e);
      }
    }
  } catch (e: unknown) {
    console.error(e);
    error.value =
      e instanceof Error ? e.message : 'Не удалось загрузить детали результата';
  } finally {
    loading.value = false;
  }
}

onMounted(loadDetails);

watch(
  () => props.agenda.table?.id,
  () => {
    loadDetails();
  },
);
</script>

<style lang="scss" scoped>
.decision-result {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  margin-top: var(--p-3);
  min-width: 0;
}

.decision-result__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.decision-result__label {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-2);

  .q-icon {
    color: var(--p-primary);
  }
}

.decision-result__title {
  margin: 0;
  font-size: var(--p-fs-h4, 1.05rem);
  font-weight: 600;
  color: var(--p-ink);
  line-height: 1.3;
}

.decision-result__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  .skel {
    height: 56px;
    border-radius: var(--p-r-md);
  }
}

.decision-result__panel {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  min-width: 0;
}

.decision-result__summary {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.decision-result__tasks {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.decision-result__section-label {
  font-weight: 500;
}

.decision-result__issues {
  margin: 0;
  padding-left: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  color: var(--p-ink);
}

.decision-result__issue-link {
  color: var(--p-primary);
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
    border-radius: var(--p-r-xs);
  }
}

.decision-result__preview {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-width: 0;
}

.decision-result__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  align-self: flex-start;
  padding: var(--p-2) var(--p-3);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
  color: var(--p-ink);
  font: inherit;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    border-color: var(--p-primary-line);
    color: var(--p-primary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
  }
}

.decision-result__preview-body {
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  min-width: 0;
  overflow: hidden;
}

.result-markdown {
  max-width: 100%;
  overflow-x: auto;
}

.result-diff-blocks {
  border-top: 1px solid var(--p-line);
  margin-top: var(--p-3);
  padding-top: var(--p-3);
}

.result-diff-viewer {
  overflow-x: auto;
  max-width: 100%;
  word-wrap: break-word;
}

.result-viewer {
  overflow-x: hidden;
  word-wrap: break-word;
  max-width: 100%;
}
</style>
