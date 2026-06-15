<template lang="pug">
//- Core-виджет просмотра документа во всю ширину экрана без переадресации.
//- Принимает УЖЕ загруженный агрегат документа (document + rawDocument) и
//- рендерит его телом BaseDocument (HTML + подписи + скачивание). Ничего не
//- догружает и никуда не ведёт — нужен там, где у пользователя есть доступ
//- к самому документу, но не обязательно к реестру документов совета
//- (например, стол бухгалтера открывает документы из реестра процессов).
BaseDialog(
  :model-value='modelValue'
  :title='title'
  maximized
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  //- Документ — листом А4 по центру экрана. На широком maximized-диалоге сам
  //- q-card документа растягивается во всю ширину и визуально «прижимается»
  //- влево; центрируем его контейнером с ограничением по ширине.
  .document-viewer__center(v-if='modelValue && documentAggregate')
    BaseDocument(:document-aggregate='documentAggregate')
  .document-viewer__center(v-else)
    .text-body2.text-grey-7 Документ недоступен
</template>

<script setup lang="ts">
import { BaseDialog } from 'src/shared/ui/base'
import { BaseDocument } from 'src/shared/ui/BaseDocument'
import type { IDocumentAggregate } from 'src/entities/Document/model'

defineProps<{
  modelValue: boolean
  documentAggregate: IDocumentAggregate | null
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style lang="scss" scoped>
.document-viewer__center {
  display: flex;
  justify-content: center;
  width: 100%;

  // Лист документа — ограничен по ширине и центрирован (страница А4).
  :deep(> *) {
    width: 100%;
    max-width: 900px;
  }
}
</style>
