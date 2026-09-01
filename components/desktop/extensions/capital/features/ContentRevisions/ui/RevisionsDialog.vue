<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Редакции"
  size="xxl"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .row.q-col-gutter-lg.revisions
    //- Слева — список редакций: одна строка на редакцию, без переносов даты
    .col-12.col-md-4
      .revisions__list
        CardListSkeleton(v-if="loading && !items.length")
        EmptyState(v-else-if="!items.length" title="Редакций пока нет")
        q-list(v-else separator)
          q-item(
            v-for="r in items"
            :key="r.rev"
            clickable
            :active="selectedRev === r.rev"
            active-class="revisions__item--active"
            @click="select(r.rev)"
          )
            q-item-section
              q-item-label.row.items-center.no-wrap
                span.t-mono-sm.revisions__rev №{{ r.rev }}
                span.revisions__date {{ formatDateToHumanDateTime(r.created_at) }}
                q-space
                BaseChip(v-if="r.rev === currentRev" size="sm" variant="info") текущая
              q-item-label(caption).revisions__meta
                | {{ r.author }} · {{ originLabel(r) }}
                template(v-if="r.merged")  · слито
                template(v-if="r.description_delta !== 0")  · {{ r.description_delta > 0 ? '+' : '' }}{{ r.description_delta }} симв.
    //- Справа — выбранная редакция: заголовок, переключатель вида, содержимое
    .col-12.col-md-8
      template(v-if="selected")
        .row.items-end.no-wrap.q-mb-md
          .col
            .text-h6 Редакция №{{ selected.rev }}
            .text-caption.text-grey-7 {{ selected.title }} · {{ selected.author }} · {{ formatDateToHumanDateTime(selected.created_at) }}
          .col-auto
            q-tabs(v-model="view" dense no-caps inline-label indicator-color="primary" active-color="primary")
              q-tab(name="diff" label="Отличия от текущей")
              q-tab(name="text" label="Текст")
        .revisions__body
          template(v-if="view === 'diff'")
            DiffViewer(v-if="diffText" :diff="diffText")
            .revisions__empty(v-else) Совпадает с текущим текстом
          pre.revisions__pre(v-else) {{ selected.description || '(пусто)' }}
      .revisions__empty(v-else-if="!loadingOne") Выберите редакцию слева
      CardListSkeleton(v-else)
  template(#footer)
    BaseButton(variant="ghost" @click="emit('update:modelValue', false)") Закрыть
    BaseButton(
      v-if="selected && selected.rev !== currentRev && canRestore"
      variant="primary"
      :loading="restoring"
      @click="restore"
    ) Вернуть эту редакцию
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseChip, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base'
import { DiffViewer } from 'src/shared/ui'
import { formatDateToHumanDateTime } from 'src/shared/lib/utils'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'
import { api, type IContentEntityType, type IContentRevision, type IContentRevisionSummary } from '../api'
import { unifiedLineDiff } from '../lib/lineDiff'

const props = defineProps<{
  modelValue: boolean
  entityType: IContentEntityType
  entityHash: string
  /** Текущее содержимое на экране — для сравнения и как base_rev при откате */
  currentTitle: string
  currentDescription: string
  currentRev: number
  canRestore: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Откат выполнен: родитель перечитывает сущность */
  restored: [summary: IContentRevisionSummary]
}>()

const items = ref<IContentRevisionSummary[]>([])
const loading = ref(false)
const loadingOne = ref(false)
const restoring = ref(false)
const selectedRev = ref<number | null>(null)
const selected = ref<IContentRevision | null>(null)
const view = ref<'diff' | 'text'>('diff')

const ORIGIN_LABELS: Record<string, string> = {
  WEB: 'веб',
  CLI: 'blago',
  RESTORE: 'откат',
  CHAIN: 'из цепи',
  BACKFILL: 'первичный снимок',
}

const originLabel = (r: IContentRevisionSummary) => {
  const base = ORIGIN_LABELS[String(r.origin)] ?? String(r.origin)
  return r.restored_from_rev ? `${base} к №${r.restored_from_rev}` : base
}

const diffText = computed(() => {
  if (!selected.value) return ''
  return unifiedLineDiff(selected.value.description, props.currentDescription)
})

async function load() {
  loading.value = true
  try {
    items.value = await api.getRevisions(props.entityType, props.entityHash)
    if (items.value.length && selectedRev.value === null) await select(items.value[0].rev)
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

async function select(rev: number) {
  selectedRev.value = rev
  loadingOne.value = true
  try {
    selected.value = await api.getRevision(props.entityType, props.entityHash, rev)
  } catch (e) {
    FailAlert(e)
  } finally {
    loadingOne.value = false
  }
}

async function restore() {
  if (!selected.value) return
  restoring.value = true
  try {
    const summary = await api.restoreRevision(props.entityType, props.entityHash, selected.value.rev, props.currentRev)
    SuccessAlert(`Возвращена редакция №${selected.value.rev}`)
    emit('restored', summary)
    emit('update:modelValue', false)
  } catch (e) {
    FailAlert(e)
  } finally {
    restoring.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedRev.value = null
      selected.value = null
      void load()
    }
  },
)
</script>

<style lang="scss" scoped>
.revisions__list,
.revisions__body {
  height: min(64vh, 640px);
  overflow: auto;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
.revisions__rev {
  color: var(--p-ink-3);
  margin-right: var(--p-2);
}
.revisions__date {
  white-space: nowrap;
}
.revisions__meta {
  margin-top: var(--p-1);
}
.revisions__item--active {
  background: var(--p-primary-soft);
  color: var(--p-ink);
}
.revisions__empty {
  padding: var(--p-4);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
.revisions__pre {
  margin: 0;
  padding: var(--p-4);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body);
}
/* На мобильнике колонки идут друг под другом — список короче, чтобы текст был виден без длинной прокрутки */
@media (max-width: 1023px) {
  .revisions__list {
    height: auto;
    max-height: 32vh;
  }
  .revisions__body {
    height: auto;
    max-height: 50vh;
  }
}
</style>
