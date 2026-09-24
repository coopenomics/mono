<template lang="pug">
.row.justify-center
  //- Строками пакет показывают в узких контейнерах (дроуэр) — на всю ширину.
  div.documents-gap.col-xs-12(:class='{ "col-md-10": !collapsible }')
    //- Свёрнутый вид: каждый документ пакета — строка, текст документа
    //- открывается по нажатию и рисуется только тогда. Нужен там, где пакет
    //- смотрят бегло (повестка совета): пять длинных документов подряд
    //- превращали карточку вопроса в бесконечную ленту.
    template(v-if='collapsible')
      .complex-document__item(v-for='item in items', :key='item.key')
        DocumentRow(
          :document='item.row',
          :class='{ "complex-document__row--open": isOpen(item.key) }',
          @open='toggle(item.key)'
        )
          template(#actions)
            q-icon.complex-document__chevron(
              :name='isOpen(item.key) ? "expand_less" : "expand_more"',
              size='20px',
              @click='toggle(item.key)'
            )
        BaseDocument.complex-document__doc.q-mt-sm(v-if='isOpen(item.key)', :documentAggregate='item.aggregate')

    //- Развёрнутый вид: все документы пакета текстом подряд.
    template(v-else)
      BaseDocument.q-mt-md(v-for='item in items', :key='item.key', :documentAggregate='item.aggregate')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseDocument } from '../BaseDocument';
import { DocumentRow, type DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow';
import type { IDocumentPackageAggregate } from 'src/entities/Document/model/types'
import type { IDocumentAggregate } from 'src/entities/Document/model'
import { t, t as i18nT } from 'src/shared/i18n';

const props = defineProps({
  documents: {
    type: Object as () => IDocumentPackageAggregate,
    required: false,
    default: undefined,
  },
  /**
   * Одиночный документ вместо пакета: у запроса одобрения документ один, а
   * показывать его нужно так же — строкой с раскрытием, а не особой вёрсткой.
   */
  document: {
    type: Object as () => IDocumentAggregate,
    required: false,
    default: undefined,
  },
  /** Показывать документы строками и раскрывать по одному. */
  collapsible: {
    type: Boolean,
    default: false,
  },
})

interface IPackageItem {
  key: string
  aggregate: IDocumentAggregate
  row: DocumentRowDoc
}

// Отметку «Подписано» строке не ставим: в пакете решения подписано всё.
const toRow = (aggregate: IDocumentAggregate, fallbackTitle: string): DocumentRowDoc => {
  const meta = (aggregate.rawDocument?.meta ?? {}) as { title?: string; created_at?: string }
  return {
    type: 'html',
    title: meta.title || fallbackTitle,
    date: meta.created_at,
  }
}

// Порядок прежний: заявление, решение, затем связанные документы — и последние
// только при наличии заявления, как было.
const items = computed<IPackageItem[]>(() => {
  if (props.document) return [{ key: 'single', aggregate: props.document, row: toRow(props.document, i18nT('ui.complexDocument.documentLabel')) }]
  const pack = props.documents
  const list: IPackageItem[] = []
  if (!pack) return list
  const statement = pack.statement?.documentAggregate
  const decision = pack.decision?.documentAggregate
  if (statement) list.push({ key: 'statement', aggregate: statement, row: toRow(statement, t('ui.complexDocument.statementLabel')) })
  if (decision) list.push({ key: 'decision', aggregate: decision, row: toRow(decision, t('ui.complexDocument.decisionLabel')) })
  if (pack.statement) {
    pack.links.forEach((linked, index) => {
      list.push({ key: `link-${index}`, aggregate: linked, row: toRow(linked, t('ui.complexDocument.documentLabel')) })
    })
  }
  return list
})

const opened = ref<Set<string>>(new Set())
const isOpen = (key: string): boolean => opened.value.has(key)
const toggle = (key: string): void => {
  const next = new Set(opened.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  opened.value = next
}
</script>

<style lang="scss" scoped>
.complex-document__item + .complex-document__item {
  margin-top: var(--p-2, 8px);
}
/* Раскрытый документ в узком контейнере: без полей в 50px, которые документ
   держит для отдельной страницы, — текст на всю ширину. */
.complex-document__doc.dynamic-padding {
  padding: var(--p-3, 12px) !important;
}
.complex-document__chevron {
  color: var(--p-ink-2);
  cursor: pointer;
}
</style>
