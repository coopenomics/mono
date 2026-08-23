<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Документ изменён параллельно"
  size="lg"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  template(v-if="conflict")
    BaseBanner(variant="warn")
      | Пока вы правили, документ сохранил кто-то ещё (редакция №{{ conflict.current_rev }}, вы начинали с №{{ conflict.base_rev }}),
      | и правки пересеклись в одном месте — автоматически слить не получилось. Ничего не потеряно: выберите, что оставить.
    .row.q-col-gutter-md.q-mt-sm
      .col-12.col-md-6
        .text-subtitle2.q-mb-xs Моя версия
        pre.conflict__pre {{ conflict.ours.description || '(пусто)' }}
      .col-12.col-md-6
        .text-subtitle2.q-mb-xs Версия на сервере
        pre.conflict__pre {{ conflict.theirs.description || '(пусто)' }}
    .text-caption.text-grey-7.q-mt-sm(v-if="conflict.title_conflict")
      | Заголовок тоже разошёлся: «{{ conflict.ours.title }}» против «{{ conflict.theirs.title }}».
  template(#footer)
    BaseButton(variant="ghost" @click="emit('update:modelValue', false)") Отмена
    BaseButton(v-if="conflict && conflict.marked" variant="secondary" @click="choose('marked')") Слить вручную (с маркерами)
    BaseButton(variant="secondary" @click="choose('theirs')") Взять серверную
    BaseButton(variant="primary" @click="choose('ours')") Оставить мою
</template>

<script setup lang="ts">
import { BaseBanner, BaseButton, BaseDialog } from 'src/shared/ui/base'
import type { IContentConflict } from '../lib/conflict'

const props = defineProps<{
  modelValue: boolean
  conflict: IContentConflict | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Выбранный текст и редакция, относительно которой его теперь сохранять (current_rev) */
  resolve: [value: { title: string; description: string; base_rev: number }]
}>()

function choose(kind: 'ours' | 'theirs' | 'marked') {
  const c = props.conflict
  if (!c) return
  const title = c.title_conflict && kind === 'theirs' ? c.theirs.title : c.ours.title
  const description = kind === 'ours' ? c.ours.description : kind === 'theirs' ? c.theirs.description : c.marked
  emit('resolve', { title, description, base_rev: c.current_rev })
  emit('update:modelValue', false)
}
</script>

<style lang="scss" scoped>
.conflict__pre {
  margin: 0;
  padding: var(--p-3);
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
</style>
