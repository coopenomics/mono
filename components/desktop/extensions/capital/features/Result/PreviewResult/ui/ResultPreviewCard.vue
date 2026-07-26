<template lang="pug">
.rid-preview(v-if='showResult')
  template(v-if='loading')
    .rid-preview__loading
      q-spinner(color='primary', size='32px')
      span.t-sm.t-muted Загрузка результата…

  template(v-else-if='error')
    .banner.banner--neg
      q-icon.banner__icon(name='error', size='20px')
      .banner__body {{ error }}

  template(v-else-if='result && result.data && parsed')
    article.rid-doc
      header.rid-doc__letterhead
        .rid-doc__coop
          q-icon.rid-doc__coop-icon(name='account_balance', size='20px')
          .rid-doc__coop-text
            .rid-doc__coop-name {{ cooperativeName }}
            .rid-doc__coop-program.t-eyebrow Программа «Благорост»
        .rid-doc__mark.t-eyebrow РИД

      .rid-doc__title-block
        h1.rid-doc__title Результат интеллектуальной деятельности
        p.rid-doc__subtitle.t-sm.t-muted(v-if='objectLabel') {{ objectLabel }}

      .rid-doc__meta
        .rid-doc__meta-row(v-if='contributorName')
          span.rid-doc__meta-label Заявитель
          span.rid-doc__meta-value {{ contributorName }}
        .rid-doc__meta-row(v-if='objectLabel')
          span.rid-doc__meta-label Объект
          span.rid-doc__meta-value {{ objectLabel }}
        .rid-doc__meta-row(v-if='formattedDate')
          span.rid-doc__meta-label Дата
          span.rid-doc__meta-value {{ formattedDate }}
        .rid-doc__meta-row(v-if='result.result_hash')
          span.rid-doc__meta-label Хеш
          span.rid-doc__meta-value.rid-doc__meta-value--hash.t-mono {{ result.result_hash }}

      .rid-doc__divider

      .rid-doc__body
        template(v-if="parsed.kind === 'v2'")
          .rid-doc__markdown
            Editor(
              :model-value='parsed.markdown',
              readonly,
              :min-height='160',
              :padded='false',
              placeholder=''
            )
          .rid-doc__diffs(v-if='parsed.diffHtmlBlocks.length')
            .rid-doc__diff(
              v-for='(block, idx) in parsed.diffHtmlBlocks',
              :key='idx',
              v-html='block'
            )
        template(v-else)
          .rid-doc__html(v-html='parsed.html')

      footer.rid-doc__footer
        span.t-meta Документ сформирован в ЦПП «Благорост»
        span.t-meta.t-mono(v-if='shortHash') {{ shortHash }}

  template(v-else)
    .banner.banner--info
      q-icon.banner__icon(name='info', size='20px')
      .banner__body
        | Текст результата ещё не сгенерирован. Нажмите кнопку «Пересчитать результат» для генерации.
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useResultStore } from 'app/extensions/capital/entities/Result/model';
import type { IResult } from 'app/extensions/capital/entities/Result/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useSystemStore } from 'src/entities/System/model';
import { Editor } from 'src/shared/ui/Editor';
import { parseCapitalResultData, type ParsedResultData } from 'app/extensions/capital/shared/lib/resultDocumentPayload';

interface Props {
  username: string;
  projectHash: string;
}

const props = defineProps<Props>();

const resultStore = useResultStore();
const contributorStore = useContributorStore();
const projectStore = useProjectStore();
const systemStore = useSystemStore();

const result = ref<IResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const showResult = ref(true);
const contributorName = ref('');
const componentTitle = ref('');
const parentTitle = ref('');

const parsed = computed<ParsedResultData | null>(() => {
  const d = result.value?.data;
  if (typeof d !== 'string' || !d.trim()) {
    return null;
  }
  return parseCapitalResultData(d);
});

const cooperativeName = computed(() => {
  return (
    systemStore.cooperativeDisplayName ||
    systemStore.info?.contacts?.full_name ||
    'Кооператив'
  );
});

const objectLabel = computed(() => {
  if (parentTitle.value && componentTitle.value) {
    return `${parentTitle.value} · ${componentTitle.value}`;
  }
  return componentTitle.value || parentTitle.value || '';
});

const formattedDate = computed(() => {
  const raw = result.value?.created_at;
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(raw);
  }
});

const shortHash = computed(() => {
  const hash = result.value?.result_hash;
  if (!hash) return '';
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
});

async function loadMeta() {
  contributorName.value = props.username || '';
  componentTitle.value = '';
  parentTitle.value = '';

  const tasks: Promise<void>[] = [];

  if (props.username) {
    tasks.push(
      contributorStore
        .loadContributor({ username: props.username })
        .then((c) => {
          contributorName.value = c?.display_name || props.username;
        })
        .catch(() => {
          contributorName.value = props.username;
        }),
    );
  }

  if (props.projectHash) {
    tasks.push(
      (async () => {
        try {
          const project =
            projectStore.getProject(props.projectHash) ||
            (await projectStore.loadProject({ hash: props.projectHash }));
          if (!project) return;
          componentTitle.value = project.title || '';
          if (project.parent_hash) {
            const parent =
              projectStore.getProject(project.parent_hash) ||
              (await projectStore.loadProject({ hash: project.parent_hash }));
            parentTitle.value = parent?.title || '';
          }
        } catch {
          // метаданные шапки необязательны
        }
      })(),
    );
  }

  await Promise.all(tasks);
}

const loadResult = async () => {
  if (!props.username || !props.projectHash) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const [loaded] = await Promise.all([
      resultStore.loadResultByFilters(props.username, props.projectHash),
      loadMeta(),
    ]);
    result.value = loaded;
  } catch (err: unknown) {
    console.error('Ошибка при загрузке результата:', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить результат';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadResult();
});

watch([() => props.username, () => props.projectHash], async () => {
  await loadResult();
});
</script>

<style lang="scss" scoped>
.rid-preview {
  max-width: 100%;
  min-width: 0;
}

.rid-preview__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3);
  padding: var(--p-8);
  color: var(--p-ink-2);
}

.rid-doc {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: var(--p-7) var(--p-6);
  background: var(--p-surface);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  box-shadow: var(--p-shadow-card);
  min-width: 0;
  overflow-x: auto;
}

.rid-doc__letterhead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-4);
  padding-bottom: var(--p-4);
  border-bottom: 2px solid var(--p-ink);
}

.rid-doc__coop {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  min-width: 0;
}

.rid-doc__coop-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--p-primary);
}

.rid-doc__coop-text {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.rid-doc__coop-name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--p-ink);
  line-height: var(--p-lh-body);
}

.rid-doc__coop-program {
  color: var(--p-ink-2);
}

.rid-doc__mark {
  flex-shrink: 0;
  padding: var(--p-1) var(--p-2);
  border: 1px solid var(--p-line-2);
  border-radius: var(--p-r-sm);
  color: var(--p-ink-2);
  letter-spacing: 0.08em;
}

.rid-doc__title-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--p-2);
  padding: var(--p-6) 0 var(--p-5);
}

.rid-doc__title {
  margin: 0;
  max-width: 28ch;
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  color: var(--p-ink);
  text-transform: uppercase;
}

.rid-doc__subtitle {
  margin: 0;
  max-width: 48ch;
}

.rid-doc__meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--p-2);
  padding: var(--p-4);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
}

.rid-doc__meta-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: var(--p-3);
  align-items: baseline;
  min-width: 0;
}

.rid-doc__meta-label {
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-3);
  text-transform: uppercase;
  letter-spacing: var(--p-ls-eyebrow);
  font-weight: 500;
}

.rid-doc__meta-value {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink);
  font-weight: 500;
  min-width: 0;
  overflow-wrap: anywhere;
}

.rid-doc__meta-value--hash {
  word-break: break-all;
  overflow-wrap: anywhere;
  white-space: normal;
  user-select: all;
}

.rid-doc__divider {
  height: 1px;
  margin: var(--p-5) 0;
  background: var(--p-line-1);
}

.rid-doc__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  min-width: 0;
}

.rid-doc__markdown {
  max-width: 100%;
  overflow-x: auto;

  :deep(.easymde-editor-container) {
    border: none;
    background: transparent;
  }

  :deep(.milkdown .ProseMirror) {
    padding: 0 !important;
    color: var(--p-ink);
    font-size: var(--p-fs-body);
    line-height: 1.65;
  }

  :deep(.milkdown .ProseMirror h1) {
    font-size: var(--p-fs-h3);
    line-height: var(--p-lh-h3);
    font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 var(--p-3);
    color: var(--p-ink);
  }

  :deep(.milkdown .ProseMirror h2) {
    font-size: var(--p-fs-body);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink-2);
    margin: var(--p-6) 0 var(--p-3);
    padding-bottom: var(--p-2);
    border-bottom: 1px solid var(--p-line);
  }

  :deep(.milkdown .ProseMirror h3) {
    font-size: var(--p-fs-body);
    font-weight: 600;
    margin: var(--p-5) 0 var(--p-2);
    color: var(--p-ink);
  }

  :deep(.milkdown .ProseMirror p) {
    margin: 0 0 var(--p-3);
    color: var(--p-ink-1);
  }

  :deep(.milkdown .ProseMirror ul),
  :deep(.milkdown .ProseMirror ol) {
    margin: 0 0 var(--p-3);
    padding-left: var(--p-5);
  }

  :deep(.milkdown .ProseMirror li) {
    margin: var(--p-1) 0;
    color: var(--p-ink-1);
  }
}

.rid-doc__diffs {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}

.rid-doc__diff {
  overflow-x: auto;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;

  :deep(.commit-content) {
    margin-bottom: var(--p-3);
  }

  :deep(.diff-container) {
    font-family: var(--p-mono);
    font-size: var(--p-fs-mono-sm);
    padding: var(--p-4);
    margin: var(--p-2) 0;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line-1);
    border-radius: var(--p-r-sm);
    background: var(--p-surface-2);
  }

  :deep(a.commit-url) {
    word-break: break-all;
    overflow-wrap: break-word;
    color: var(--p-primary);
    text-decoration: none;
  }

  :deep(.diff-header) {
    font-weight: 600;
    margin: 0;
    padding: 2px 0;
    color: var(--p-ink);
  }

  :deep(.diff-meta) {
    margin: 0;
    padding: 2px 0;
    color: var(--p-ink-2);
  }

  :deep(.diff-hunk) {
    font-weight: 600;
    margin: 0;
    padding: 2px 0;
    color: var(--p-info);
  }

  :deep(.diff-add) {
    margin: 0;
    padding: 2px 0;
    background-color: var(--p-pos-soft);
    color: var(--p-pos);
  }

  :deep(.diff-del) {
    margin: 0;
    padding: 2px 0;
    background-color: var(--p-neg-soft);
    color: var(--p-neg);
  }

  :deep(.diff-normal) {
    margin: 0;
    padding: 2px 0;
    color: var(--p-ink-1);
  }
}

.rid-doc__html {
  overflow-x: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
  font-size: var(--p-fs-body);
  line-height: 1.65;
  color: var(--p-ink-1);

  :deep(*) {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  :deep(.result-document) {
    line-height: 1.65;
    max-width: 100%;
    margin: 0 auto;
  }

  :deep(.result-title) {
    border-bottom: 2px solid var(--p-ink);
    padding-bottom: var(--p-3);
    margin-bottom: var(--p-5);
  }

  :deep(.result-section) {
    margin-top: var(--p-6);
  }

  :deep(.result-section-title) {
    margin-top: var(--p-6);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink-2);
  }

  :deep(a) {
    color: var(--p-primary);
    word-break: break-all;
    overflow-wrap: break-word;
  }

  :deep(pre),
  :deep(code) {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
    font-family: var(--p-mono);
  }

  :deep(.diff-container) {
    font-family: var(--p-mono);
    padding: var(--p-4);
    margin: var(--p-2) 0;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-line-1);
    border-radius: var(--p-r-sm);
    background: var(--p-surface-2);
  }

  :deep(.diff-header) {
    font-weight: 600;
    margin: 0;
    padding: 2px 0;
    color: var(--p-ink);
  }

  :deep(.diff-meta) {
    margin: 0;
    padding: 2px 0;
    color: var(--p-ink-2);
  }

  :deep(.diff-hunk) {
    font-weight: 600;
    margin: 0;
    padding: 2px 0;
    color: var(--p-info);
  }

  :deep(.diff-add) {
    margin: 0;
    padding: 2px 0;
    background-color: var(--p-pos-soft);
    color: var(--p-pos);
  }

  :deep(.diff-del) {
    margin: 0;
    padding: 2px 0;
    background-color: var(--p-neg-soft);
    color: var(--p-neg);
  }

  :deep(.diff-normal) {
    margin: 0;
    padding: 2px 0;
  }
}

.rid-doc__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  margin-top: var(--p-6);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line-1);
  color: var(--p-ink-3);
}

@media (max-width: 600px) {
  .rid-doc {
    padding: var(--p-5) var(--p-4);
  }

  .rid-doc__meta-row {
    grid-template-columns: 1fr;
    gap: var(--p-1);
  }

  .rid-doc__title {
    font-size: var(--p-fs-h3);
    line-height: var(--p-lh-h3);
  }

  .rid-doc__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
