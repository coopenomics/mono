<template lang="pug">
div.result-preview-card(v-if='showResult')
  template(v-if='loading')
    .text-center.q-pa-md
      q-spinner(color='primary', size='40px')
      .q-mt-sm Загрузка результата...

  template(v-else-if='error')
    .banner.banner--neg
      q-icon.banner__icon(name='error', size='20px')
      .banner__body {{ error }}

  template(v-else-if='result && result.data && parsed')
    template(v-if="parsed.kind === 'v2'")
      .result-markdown
        Editor(
          :model-value='parsed.markdown',
          readonly,
          :min-height='200',
          :padded='false',
          placeholder=''
        )
      .result-diff-blocks(v-if='parsed.diffHtmlBlocks.length')
        .result-diff-viewer(
          v-for='(block, idx) in parsed.diffHtmlBlocks',
          :key='idx',
          v-html='block'
        )
    template(v-else)
      .result-viewer(v-html='parsed.html')

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
import { Editor } from 'src/shared/ui/Editor';
import { parseCapitalResultData, type ParsedResultData } from 'app/extensions/capital/shared/lib/resultDocumentPayload';

interface Props {
  username: string;
  projectHash: string;
}

const props = defineProps<Props>();

const resultStore = useResultStore();
const result = ref<IResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const showResult = ref(true);

const parsed = computed<ParsedResultData | null>(() => {
  const d = result.value?.data;
  if (typeof d !== 'string' || !d.trim()) {
    return null;
  }
  return parseCapitalResultData(d);
});

const loadResult = async () => {
  if (!props.username || !props.projectHash) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    result.value = await resultStore.loadResultByFilters(props.username, props.projectHash);
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
.result-preview-card {
  max-width: 100%;
  overflow: hidden;
}

.result-markdown {
  max-width: 100%;
  overflow-x: auto;
}

.result-diff-blocks {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin-top: 8px;
  padding-top: 8px;
}

.result-diff-viewer {
  padding: 0 16px 16px;
  overflow-x: auto;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;

  :deep(.commit-content) {
    margin-bottom: 12px;
  }

  :deep(.diff-container) {
    font-family: monospace;
    padding: 16px;
    margin: 10px 0;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    flex-direction: column;
    border: 1px solid #d1d5db;
    border-radius: 6px;
  }

  :deep(a.commit-url) {
    word-break: break-all;
    overflow-wrap: break-word;
    color: #0066cc;
    text-decoration: none;
  }

  :deep(.diff-header) {
    font-weight: bold;
    margin: 0;
    padding: 2px 0;
    color: #333;
  }

  :deep(.diff-meta) {
    margin: 0;
    padding: 2px 0;
    color: #666;
  }

  :deep(.diff-hunk) {
    font-weight: bold;
    margin: 0;
    padding: 2px 0;
    color: #0066cc;
  }

  :deep(.diff-add) {
    margin: 0;
    padding: 2px 0;
    background-color: #e6ffec;
    color: #22863a;
  }

  :deep(.diff-del) {
    margin: 0;
    padding: 2px 0;
    background-color: #ffeef0;
    color: #cb2431;
  }

  :deep(.diff-normal) {
    margin: 0;
    padding: 2px 0;
  }
}

.result-viewer {
  padding: 16px;
  overflow-x: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;

  :deep(*) {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  :deep(.result-document) {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    max-width: 100%;
    margin: 0 auto;
  }

  :deep(.result-title) {
    border-bottom: 2px solid #333;
    padding-bottom: 10px;
    margin-bottom: 20px;
  }

  :deep(.result-section) {
    margin-top: 30px;
  }

  :deep(.result-description) {
    margin: 15px 0;
  }

  :deep(.requirements-list),
  :deep(.tasks-list) {
    margin: 10px 0;
    padding-left: 20px;
  }

  :deep(.requirements-list li),
  :deep(.tasks-list li) {
    margin: 5px 0;
  }

  :deep(.task-requirements) {
    margin: 10px 0;
    padding-left: 20px;
  }

  :deep(.task-requirements li) {
    margin: 3px 0;
  }

  :deep(.executed-tasks) {
    margin: 10px 0;
    padding-left: 20px;
  }

  :deep(.executed-tasks li) {
    margin: 5px 0;
  }

  :deep(.result-section-title) {
    margin-top: 30px;
  }

  :deep(.commit-link) {
    margin-bottom: 15px;
  }

  :deep(.commit-url) {
    color: #0066cc;
    text-decoration: none;
  }

  :deep(.commit-url:hover) {
    text-decoration: underline;
  }

  :deep(.diff-container) {
    font-family: monospace;
    padding: 16px;
    margin: 10px 0;
    overflow-x: auto;
    max-width: 100%;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    flex-direction: column;
    border: none !important;
  }

  :deep(a) {
    word-break: break-all;
    overflow-wrap: break-word;
  }

  :deep(pre) {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    max-width: 100%;
  }

  :deep(code) {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  :deep(.diff-header) {
    font-weight: bold;
    margin: 0;
    padding: 2px 0;
    color: #333;
  }

  :deep(.diff-meta) {
    margin: 0;
    padding: 2px 0;
    color: #666;
  }

  :deep(.diff-hunk) {
    font-weight: bold;
    margin: 0;
    padding: 2px 0;
    color: #0066cc;
  }

  :deep(.diff-add) {
    margin: 0;
    padding: 2px 0;
    background-color: #e6ffec;
    color: #22863a;
  }

  :deep(.diff-del) {
    margin: 0;
    padding: 2px 0;
    background-color: #ffeef0;
    color: #cb2431;
  }

  :deep(.diff-normal) {
    margin: 0;
    padding: 2px 0;
  }
}
</style>
