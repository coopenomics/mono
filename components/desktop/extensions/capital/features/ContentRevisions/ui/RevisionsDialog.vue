<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Редакции"
  size="lg"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .row.q-col-gutter-md.revisions
    .col-12.col-md-4
      .text-caption.text-grey-7.q-mb-xs Список редакций (новые сверху)
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
              q-item-label
                span.t-mono-sm.q-mr-sm №{{ r.rev }}
                span {{ formatDateToHumanDateTime(r.created_at) }}
              q-item-label(caption)
                | {{ r.author }} · {{ originLabel(r) }}
                template(v-if="r.merged")  · слито
                template(v-if="r.description_delta !== 0")  · {{ r.description_delta > 0 ? '+' : '' }}{{ r.description_delta }} симв.
            q-item-section(side v-if="r.rev === currentRev")
              BaseChip(size="sm" variant="info") текущая
    .col-12.col-md-8
      template(v-if="selected")
        .row.items-center.q-mb-sm
          .col
            .text-subtitle2 Редакция №{{ selected.rev }}
            .text-caption.text-grey-7 {{ selected.title }}
          .col-auto.row.q-gutter-xs
            BaseButton(size="sm" :variant="view === 'diff' ? 'secondary' : 'ghost'" @click="view = 'diff'") Отличия от текущей
            BaseButton(size="sm" :variant="view === 'text' ? 'secondary' : 'ghost'" @click="view = 'text'") Текст
        .revisions__body
          template(v-if="view === 'diff'")
            DiffViewer(v-if="diffText" :diff="diffText")
            .text-caption.text-grey-7.q-pa-sm(v-else) Совпадает с текущим текстом
          pre.revisions__pre(v-else) {{ selected.description || '(пусто)' }}
      .text-caption.text-grey-7(v-else-if="!loadingOne") Выберите редакцию слева
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
.revisions__list {
  max-height: 60vh;
  overflow: auto;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
.revisions__item--active {
  background: var(--p-primary-soft);
  color: var(--p-ink);
}
.revisions__body {
  max-height: 60vh;
  overflow: auto;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
.revisions__pre {
  margin: 0;
  padding: var(--p-3);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
}
</style>
