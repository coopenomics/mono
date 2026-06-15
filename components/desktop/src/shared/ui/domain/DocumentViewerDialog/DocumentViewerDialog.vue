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
  //- к краю; центрируем его листом фиксированной ширины с margin: auto
  //- (тот же приём, что в ConfirmWriteoffDialog — надёжнее flex/:deep).
  .document-viewer__sheet(v-if='modelValue && documentAggregate')
    BaseDocument(:document-aggregate='documentAggregate')
  .document-viewer__sheet(v-else)
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
// Лист документа — ограничен по ширине и центрирован (страница А4):
// margin: 0 auto в блочном потоке центрирует надёжнее, чем flex+:deep.
.document-viewer__sheet {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}
</style>
